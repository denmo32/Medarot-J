/**
 * @file 戦闘計算式ユーティリティ
 * ダメージ、回避、防御、クリティカル率など、戦闘におけるあらゆる計算式を定義します。
 * ゲームバランスの調整は、主にこのファイルと`config.js`で行います。
 * すべての計算は `CombatCalculator` シングルトンを介して行われ、
 * 必要に応じて内部の戦略(`strategy`)を差し替えることで、計算アルゴリズム全体を変更できます。
 */

import { CONFIG } from '../common/config.js';
import { Parts, PlayerInfo, ActiveEffects } from '../core/components/index.js';
import { findBestDefensePart } from './queryUtils.js';
import { ErrorHandler, GameError, ErrorType } from './errorHandler.js';
import { EffectType, AttackType } from '../common/constants.js';

/**
 * 戦闘計算戦略のインターフェース
 * @interface CombatStrategy
 */
export class CombatStrategy {
    /**
     * 回避確率を計算する
     * @param {object} context - 計算に必要なコンテキスト
     * @returns {number} 0-1の範囲の確率
     */
    calculateEvasionChance(context) {
        throw new GameError('calculateEvasionChance method must be implemented', ErrorType.CALCULATION_ERROR);
    }

    /**
     * 防御確率を計算する
     * @param {object} context - 計算に必要なコンテキスト
     * @returns {number} 0-1の範囲の確率
     */
    calculateDefenseChance(context) {
        throw new GameError('calculateDefenseChance method must be implemented', ErrorType.CALCULATION_ERROR);
    }

    /**
     * クリティカルヒットの発生確率を計算する
     * @param {object} context - 計算に必要なコンテキスト
     * @returns {number} 0-1の範囲の確率
     */
    calculateCriticalChance(context) {
        throw new GameError('calculateCriticalChance method must be implemented', ErrorType.CALCULATION_ERROR);
    }

    /**
     * ダメージを計算する
     * @param {object} context - 計算に必要なコンテキスト
     * @returns {number} 計算されたダメージ値
     */
    calculateDamage(context) {
        throw new GameError('calculateDamage method must be implemented', ErrorType.CALCULATION_ERROR);
    }

    /**
     * パーツ性能に基づき、速度補正率を計算する
     * @param {object} context - 計算に必要なコンテキスト
     * @returns {number} 速度補正率 (1.0が基準)
     */
    calculateSpeedMultiplier(context) {
        throw new GameError('calculateSpeedMultiplier method must be implemented', ErrorType.CALCULATION_ERROR);
    }

    /**
     * 攻撃の命中結果（回避、クリティカル、防御）を総合的に判定します。
     * ActionSystemからロジックを移譲されました。
     * @param {object} context - 計算に必要なコンテキスト
     * @returns {{isHit: boolean, isCritical: boolean, isDefended: boolean, finalTargetPartKey: string}} 命中結果
     */
    resolveHitOutcome(context) {
        throw new GameError('resolveHitOutcome method must be implemented', ErrorType.CALCULATION_ERROR);
    }
}

/**
 * デフォルトの戦闘計算戦略実装
 * @class DefaultCombatStrategy
 * @implements {CombatStrategy}
 */
class DefaultCombatStrategy extends CombatStrategy {
    /**
     * @param {{world: World, attackerId: number, targetLegs: object, attackingPart: object}} context
     */
    calculateEvasionChance({ world, attackerId, targetLegs, attackingPart }) {
        try {
            const mobility = targetLegs?.mobility;
            const success = attackingPart?.success;
            if (mobility === undefined || success === undefined) return 0;
            
            let scanBonus = 0;
            if (world && attackerId !== undefined) {
                const activeEffects = world.getComponent(attackerId, ActiveEffects);
                if (activeEffects) {
                    scanBonus = activeEffects.effects
                        .filter(e => e.type === EffectType.APPLY_SCAN)
                        .reduce((total, e) => total + e.value, 0);
                }
            }
            const formula = CONFIG.FORMULAS.EVASION;
            const adjustedSuccess = success + scanBonus;
            const base = (mobility - adjustedSuccess) / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
            return Math.max(0, Math.min(formula.MAX_CHANCE, base));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateEvasionChance', context });
            return 0;
        }
    }

    /**
     * @param {{targetLegs: object}} context
     */
    calculateDefenseChance({ targetLegs }) {
        try {
            const armor = targetLegs?.armor;
            if (typeof armor !== 'number') return 0;
            const formula = CONFIG.FORMULAS.DEFENSE;
            const base = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;
            return Math.max(0, Math.min(formula.MAX_CHANCE, base));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateDefenseChance', context });
            return 0;
        }
    }

    /**
     * @param {{attackingPart: object, targetLegs: object}} context
     */
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
            ErrorHandler.handle(error, { method: 'calculateCriticalChance', context });
            return 0;
        }
    }

    /**
     * @param {{attackingPart: object, attackerLegs: object, targetLegs: object, isCritical?: boolean, isDefenseBypassed?: boolean}} context
     */
    calculateDamage({ attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false }) {
        try {
            if (!attackingPart || !attackerLegs || !targetLegs) return 0;

            let success = attackingPart.success || 0;
            let might = attackingPart.might || 0;
            const mobility = targetLegs.mobility || 0;
            let armor = targetLegs.armor || 0;
            let bonusValue = 0;

            // caseをマジックストリングからAttackType定数に変更
            switch (attackingPart.type) {
                case AttackType.AIMED_SHOT:
                    bonusValue = Math.floor((attackerLegs.stability || 0) / 2);
                    success += bonusValue;
                    break;
                case AttackType.STRIKE:
                    bonusValue = Math.floor((attackerLegs.mobility || 0) / 2);
                    success += bonusValue;
                    break;
                case AttackType.RECKLESS:
                    bonusValue = Math.floor((attackerLegs.propulsion || 0) / 2);
                    might += bonusValue;
                    break;
            }

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
            ErrorHandler.handle(error, { method: 'calculateDamage', context });
            return 0;
        }
    }

    /**
     * @param {{part: object, factorType: 'charge' | 'cooldown'}} context
     */
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
            ErrorHandler.handle(error, { method: 'calculateSpeedMultiplier', context });
            return 1.0;
        }
    }

    /**
     * 攻撃の命中結果（回避、クリティカル、防御）を総合的に判定します。
     * ActionSystemからロジックを移譲されました。
     * @param {{world: World, attackerId: number, targetId: number, attackingPart: object, targetLegs: object, initialTargetPartKey: string}} context
     * @returns {{isHit: boolean, isCritical: boolean, isDefended: boolean, finalTargetPartKey: string}} 命中結果
     */
    resolveHitOutcome({ world, attackerId, targetId, attackingPart, targetLegs, initialTargetPartKey }) {
        // isSupportフラグをパーツオブジェクトから直接参照
        if (attackingPart.isSupport) {
            return { isHit: true, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // ターゲットがいない（空振り）場合は命中しない
        if (!targetId || !targetLegs) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // 1. 回避判定
        const evasionChance = this.calculateEvasionChance({
            world: world,
            attackerId: attackerId,
            targetLegs: targetLegs,
            attackingPart: attackingPart,
        });
        if (Math.random() < evasionChance) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // 2. クリティカル判定
        const critChance = this.calculateCriticalChance({ attackingPart, targetLegs });
        const isCritical = Math.random() < critChance;

        // 3. 防御判定 (クリティカルでない場合のみ)
        let isDefended = false;
        let finalTargetPartKey = initialTargetPartKey;
        if (!isCritical) {
            const defenseChance = this.calculateDefenseChance({ targetLegs });
            if (Math.random() < defenseChance) {
                // queryUtilsから最適な防御パーツを探す
                const defensePartKey = findBestDefensePart(world, targetId);
                if (defensePartKey) {
                    isDefended = true;
                    finalTargetPartKey = defensePartKey;
                }
            }
        }

        return { isHit: true, isCritical, isDefended, finalTargetPartKey };
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
    // 移譲されたメソッドをシングルトンに追加
    resolveHitOutcome(context) { return this.strategy.resolveHitOutcome(context); }
};