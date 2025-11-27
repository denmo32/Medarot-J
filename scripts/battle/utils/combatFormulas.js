/**
 * @file 戦闘計算式ユーティリティ
 */

import { CONFIG } from '../common/config.js';
// scripts/battle/utils/ -> ../../components/index.js
import { findBestDefensePart } from './queryUtils.js';
// engineはルート直下にあるため ../../../ で正しい (utils -> battle -> scripts -> root)
import { GameError, ErrorType } from '../../../engine/utils/ErrorHandler.js';
// scripts/battle/utils/ -> ../../common/constants.js
import { AttackType as CommonAttackType, EffectType as CommonEffectType } from '../../common/constants.js';
import { clamp } from '../../../engine/utils/MathUtils.js';
import { ActiveEffects } from '../components/ActiveEffects.js';

export class CombatStrategy {
    calculateEvasionChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDefenseChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateCriticalChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDamage(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateSpeedMultiplier(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateGaugeUpdate(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    resolveHitOutcome(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
}

class DefaultCombatStrategy extends CombatStrategy {
    
    calculateEvasionChance({ world, attackerId, targetLegs, attackingPart }) {
        if (!targetLegs || !attackingPart) return 0;

        const mobility = targetLegs.mobility ?? 0;
        const success = attackingPart.success ?? 0;
        
        const scanBonus = this._calculateScanBonus(world, attackerId);
        const adjustedSuccess = success + scanBonus;
        
        const formula = CONFIG.FORMULAS.EVASION;
        const mobilityAdvantage = mobility - adjustedSuccess;
        const evasionChance = mobilityAdvantage / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
        
        return clamp(evasionChance, 0, formula.MAX_CHANCE);
    }

    calculateDefenseChance({ targetLegs }) {
        if (!targetLegs) return 0;
        
        const armor = targetLegs.armor;
        if (typeof armor !== 'number') return 0;

        const formula = CONFIG.FORMULAS.DEFENSE;
        const defenseChance = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;

        return clamp(defenseChance, 0, formula.MAX_CHANCE);
    }

    calculateCriticalChance({ attackingPart, targetLegs }) {
        if (!attackingPart || !targetLegs) return 0;
        
        const success = attackingPart.success ?? 0;
        const mobility = targetLegs.mobility ?? 0;
        
        const successAdvantage = Math.max(0, success - mobility);
        
        const config = CONFIG.CRITICAL_HIT;
        const baseChance = successAdvantage / config.DIFFERENCE_FACTOR;
        const typeBonus = config.TYPE_BONUS[attackingPart.type] || 0;
        
        return clamp(baseChance + typeBonus, 0, 1);
    }

    calculateDamage({ attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false }) {
        if (!attackingPart || !attackerLegs || !targetLegs) return 0;

        let success = attackingPart.success ?? 0;
        let might = attackingPart.might ?? 0;
        const mobility = targetLegs.mobility ?? 0;
        let armor = targetLegs.armor ?? 0;

        const { successBonus, mightBonus } = this._calculateTypeBonus(attackingPart.type, attackerLegs);
        success += successBonus;
        might += mightBonus;

        const stabilityDefenseBonus = Math.floor((targetLegs.stability || 0) / 2);
        armor += stabilityDefenseBonus;
        
        let baseDamage;
        if (isCritical) {
            baseDamage = Math.max(0, success);
        } else {
            const effectiveArmor = isDefenseBypassed ? 0 : armor;
            baseDamage = Math.max(0, success - mobility - effectiveArmor);
        }

        const finalDamage = Math.floor(baseDamage / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + might;
        
        return finalDamage;
    }

    calculateSpeedMultiplier({ part, factorType }) {
        if (!part) return 1.0;
        
        const config = CONFIG.TIME_ADJUSTMENT;
        const impactFactor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;
        
        const might = part.might ?? 0;
        const success = part.success ?? 0;
        
        const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
        const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
        
        const performanceScore = mightScore + successScore;
        
        let multiplier = 1.0 + (performanceScore * impactFactor);
        
        const typeModifier = CONFIG.PART_TYPE_MODIFIERS?.[part.type];
        if (typeModifier?.speedMultiplier) {
            multiplier *= typeModifier.speedMultiplier;
        }
        return multiplier;
    }

    /**
     * ゲージの更新量と次の速度を計算します。
     * @param {object} context
     * @param {number} context.currentSpeed - 現在のゲージ増加速度
     * @param {number} context.mobility - 機動（加速度に影響）
     * @param {number} context.propulsion - 推進（最大速度に影響）
     * @param {number} context.speedMultiplier - 速度補正（チャージ/冷却など）
     * @param {number} context.deltaTime - 経過時間
     * @returns {{ nextSpeed: number, increment: number }}
     */
    calculateGaugeUpdate({ currentSpeed, mobility, propulsion, speedMultiplier, deltaTime }) {
        const { 
            BASE_ACCELERATION, 
            MOBILITY_TO_ACCELERATION, 
            BASE_MAX_SPEED, 
            PROPULSION_TO_MAX_SPEED
        } = CONFIG.FORMULAS.GAUGE;
        
        const timeFactor = deltaTime / CONFIG.UPDATE_INTERVAL;

        const acceleration = BASE_ACCELERATION + (mobility * MOBILITY_TO_ACCELERATION);
        const maxSpeed = BASE_MAX_SPEED + (propulsion * PROPULSION_TO_MAX_SPEED);
        
        const nextSpeed = Math.min(currentSpeed + acceleration, maxSpeed);
        
        // speedMultiplierが大きいほど遅くなる（分母にある）仕様
        const increment = (nextSpeed / speedMultiplier) * timeFactor;

        return { nextSpeed, increment };
    }

    resolveHitOutcome({ world, attackerId, targetId, attackingPart, targetLegs, initialTargetPartKey }) {
        const defaultOutcome = { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };

        if (attackingPart.isSupport) {
            return { ...defaultOutcome, isHit: true };
        }

        if (!targetId || !targetLegs) {
            return defaultOutcome;
        }

        const evasionChance = this.calculateEvasionChance({ world, attackerId, targetLegs, attackingPart });
        const isEvaded = Math.random() < evasionChance;
        
        if (isEvaded) {
            return defaultOutcome;
        }

        const critChance = this.calculateCriticalChance({ attackingPart, targetLegs });
        const isCritical = Math.random() < critChance;

        if (isCritical) {
            return { ...defaultOutcome, isHit: true, isCritical: true };
        }

        const defenseChance = this.calculateDefenseChance({ targetLegs });
        const isDefended = Math.random() < defenseChance;

        if (isDefended) {
            const defensePartKey = findBestDefensePart(world, targetId);
            if (defensePartKey) {
                return { ...defaultOutcome, isHit: true, isDefended: true, finalTargetPartKey: defensePartKey };
            }
        }

        return { ...defaultOutcome, isHit: true };
    }

    _calculateScanBonus(world, attackerId) {
        if (!world || attackerId === undefined) return 0;
        
        const activeEffects = world.getComponent(attackerId, ActiveEffects);
        if (!activeEffects) return 0;
        
        return activeEffects.effects
            .filter(e => e.type === CommonEffectType.APPLY_SCAN)
            .reduce((total, e) => total + e.value, 0);
    }

    _calculateTypeBonus(attackType, attackerLegs) {
        let successBonus = 0;
        let mightBonus = 0;

        if (!attackerLegs) return { successBonus, mightBonus };

        switch (attackType) {
            case CommonAttackType.AIMED_SHOT:
                successBonus = Math.floor((attackerLegs.stability || 0) / 2);
                break;
            case CommonAttackType.STRIKE:
                successBonus = Math.floor((attackerLegs.mobility || 0) / 2);
                break;
            case CommonAttackType.RECKLESS:
                mightBonus = Math.floor((attackerLegs.propulsion || 0) / 2);
                break;
        }

        return { successBonus, mightBonus };
    }
}

export const CombatCalculator = {
    strategy: new DefaultCombatStrategy(),
    
    setStrategy(newStrategy) {
        if (newStrategy instanceof CombatStrategy) {
            this.strategy = newStrategy;
        } else {
            console.warn('Invalid combat strategy provided.');
        }
    },
    
    calculateEvasionChance(context) { return this.strategy.calculateEvasionChance(context); },
    calculateDefenseChance(context) { return this.strategy.calculateDefenseChance(context); },
    calculateCriticalChance(context) { return this.strategy.calculateCriticalChance(context); },
    calculateDamage(context) { return this.strategy.calculateDamage(context); },
    calculateSpeedMultiplier(context) { return this.strategy.calculateSpeedMultiplier(context); },
    calculateGaugeUpdate(context) { return this.strategy.calculateGaugeUpdate(context); },
    resolveHitOutcome(context) { return this.strategy.resolveHitOutcome(context); }
};