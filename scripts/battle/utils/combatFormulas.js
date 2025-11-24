/**
 * @file 戦闘計算式ユーティリティ
 * ダメージ、回避、防御、クリティカル率など、戦闘におけるあらゆる計算式を定義します。
 */

import { CONFIG } from '../common/config.js';
import { Parts, PlayerInfo, ActiveEffects, Gauge } from '../core/components/index.js';
import { findBestDefensePart } from './queryUtils.js';
import { ErrorHandler, GameError, ErrorType } from './errorHandler.js';
import { EffectType, AttackType } from '../common/constants.js';

/**
 * 戦闘計算戦略のインターフェース
 * @interface CombatStrategy
 */
export class CombatStrategy {
    calculateEvasionChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDefenseChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateCriticalChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDamage(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateSpeedMultiplier(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateGaugeIncrement(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    resolveHitOutcome(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
}

/**
 * デフォルトの戦闘計算戦略実装
 * @class DefaultCombatStrategy
 * @implements {CombatStrategy}
 */
class DefaultCombatStrategy extends CombatStrategy {
    
    calculateEvasionChance({ world, attackerId, targetLegs, attackingPart }) {
        try {
            const mobility = targetLegs?.mobility;
            const success = attackingPart?.success;
            if (mobility === undefined || success === undefined) return 0;
            
            // スキャン効果によるボーナス計算
            const scanBonus = this._calculateScanBonus(world, attackerId);
            
            const formula = CONFIG.FORMULAS.EVASION;
            const adjustedSuccess = success + scanBonus;
            const base = (mobility - adjustedSuccess) / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
            return Math.max(0, Math.min(formula.MAX_CHANCE, base));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateEvasionChance' });
            return 0;
        }
    }

    calculateDefenseChance({ targetLegs }) {
        try {
            const armor = targetLegs?.armor;
            if (typeof armor !== 'number') return 0;
            const formula = CONFIG.FORMULAS.DEFENSE;
            const base = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;
            return Math.max(0, Math.min(formula.MAX_CHANCE, base));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateDefenseChance' });
            return 0;
        }
    }

    calculateCriticalChance({ attackingPart, targetLegs }) {
        try {
            if (!attackingPart || !targetLegs) return 0;
            const config = CONFIG.CRITICAL_HIT;
            const success = attackingPart.success || 0;
            const mobility = targetLegs.mobility || 0;
            
            const difference = Math.max(0, success - mobility);
            let chance = difference / config.DIFFERENCE_FACTOR;
            
            const typeBonus = config.TYPE_BONUS[attackingPart.type] || 0;
            chance += typeBonus;
            
            return Math.max(0, Math.min(1, chance));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateCriticalChance' });
            return 0;
        }
    }

    calculateDamage({ attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false }) {
        try {
            if (!attackingPart || !attackerLegs || !targetLegs) return 0;

            let success = attackingPart.success || 0;
            let might = attackingPart.might || 0;
            const mobility = targetLegs.mobility || 0;
            let armor = targetLegs.armor || 0;

            // 攻撃タイプごとのボーナスを適用
            const bonuses = this._calculateTypeBonus(attackingPart.type, attackerLegs);
            success += bonuses.successBonus;
            might += bonuses.mightBonus;

            // 防御側の脚部安定性によるボーナス
            const defenseBonus = Math.floor((targetLegs.stability || 0) / 2);
            armor += defenseBonus;
            
            let baseDamage;
            if (isCritical) {
                baseDamage = Math.max(0, success);
            } else {
                if (isDefenseBypassed) armor = 0;
                baseDamage = Math.max(0, success - mobility - armor);
            }
            return Math.floor(baseDamage / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + might;
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateDamage' });
            return 0;
        }
    }

    calculateSpeedMultiplier({ part, factorType }) {
        try {
            if (!part) return 1.0;
            const config = CONFIG.TIME_ADJUSTMENT;
            const factor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;
            
            const might = part.might || 0;
            const success = part.success || 0;
            
            const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
            const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
            
            const performanceScore = mightScore + successScore;
            let multiplier = 1.0 + (performanceScore * factor);
            
            const typeModifier = CONFIG.PART_TYPE_MODIFIERS?.[part.type];
            if (typeModifier?.speedMultiplier) {
                multiplier *= typeModifier.speedMultiplier;
            }
            return multiplier;
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateSpeedMultiplier' });
            return 1.0;
        }
    }

    calculateGaugeIncrement({ world, entityId, deltaTime }) {
        try {
            const gauge = world.getComponent(entityId, Gauge);
            const parts = world.getComponent(entityId, Parts);
            if (!gauge || !parts) return 0;

            const propulsion = parts.legs?.propulsion || 1;
            const speedMultiplier = gauge.speedMultiplier || 1.0;
            
            return (propulsion / CONFIG.FORMULAS.GAUGE.GAUGE_INCREMENT_DIVISOR) * (deltaTime / CONFIG.UPDATE_INTERVAL) / speedMultiplier;
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateGaugeIncrement' });
            return 0;
        }
    }

    resolveHitOutcome({ world, attackerId, targetId, attackingPart, targetLegs, initialTargetPartKey }) {
        const defaultOutcome = { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };

        // 支援行動は常に成功扱い
        if (attackingPart.isSupport) {
            return { ...defaultOutcome, isHit: true };
        }

        // ターゲット不在（空振り）
        if (!targetId || !targetLegs) {
            return defaultOutcome;
        }

        // 1. 回避判定
        const evasionChance = this.calculateEvasionChance({ world, attackerId, targetLegs, attackingPart });
        if (Math.random() < evasionChance) {
            return defaultOutcome; // 回避成功
        }

        // 2. クリティカル判定
        const critChance = this.calculateCriticalChance({ attackingPart, targetLegs });
        const isCritical = Math.random() < critChance;

        // クリティカルなら防御判定はスキップ
        if (isCritical) {
            return { ...defaultOutcome, isHit: true, isCritical: true };
        }

        // 3. 防御判定
        const defenseChance = this.calculateDefenseChance({ targetLegs });
        if (Math.random() < defenseChance) {
            const defensePartKey = findBestDefensePart(world, targetId);
            if (defensePartKey) {
                return { ...defaultOutcome, isHit: true, isDefended: true, finalTargetPartKey: defensePartKey };
            }
        }

        // 通常命中
        return { ...defaultOutcome, isHit: true };
    }

    // --- Helper Methods ---

    _calculateScanBonus(world, attackerId) {
        if (!world || attackerId === undefined) return 0;
        const activeEffects = world.getComponent(attackerId, ActiveEffects);
        if (!activeEffects) return 0;
        
        return activeEffects.effects
            .filter(e => e.type === EffectType.APPLY_SCAN)
            .reduce((total, e) => total + e.value, 0);
    }

    _calculateTypeBonus(attackType, attackerLegs) {
        let successBonus = 0;
        let mightBonus = 0;

        switch (attackType) {
            case AttackType.AIMED_SHOT:
                successBonus = Math.floor((attackerLegs.stability || 0) / 2);
                break;
            case AttackType.STRIKE:
                successBonus = Math.floor((attackerLegs.mobility || 0) / 2);
                break;
            case AttackType.RECKLESS:
                mightBonus = Math.floor((attackerLegs.propulsion || 0) / 2);
                break;
        }

        return { successBonus, mightBonus };
    }
}

// 戦略を変更するためのシングルトンオブジェクト
export const CombatCalculator = {
    strategy: new DefaultCombatStrategy(),
    
    setStrategy(newStrategy) {
        if (newStrategy instanceof CombatStrategy) {
            this.strategy = newStrategy;
        } else {
            ErrorHandler.handle(new GameError('Invalid combat strategy provided.', ErrorType.VALIDATION_ERROR));
        }
    },
    
    calculateEvasionChance(context) { return this.strategy.calculateEvasionChance(context); },
    calculateDefenseChance(context) { return this.strategy.calculateDefenseChance(context); },
    calculateCriticalChance(context) { return this.strategy.calculateCriticalChance(context); },
    calculateDamage(context) { return this.strategy.calculateDamage(context); },
    calculateSpeedMultiplier(context) { return this.strategy.calculateSpeedMultiplier(context); },
    calculateGaugeIncrement(context) { return this.strategy.calculateGaugeIncrement(context); },
    resolveHitOutcome(context) { return this.strategy.resolveHitOutcome(context); }
};