/**
 * @file CombatCalculator.js
 * @description 純粋な戦闘計算式ロジック
 * WorldやEntityには依存せず、渡された数値パラメータのみに基づいて計算を行う。
 */

import { CONFIG } from '../common/config.js';
import { GameError, ErrorType } from '../../../engine/utils/ErrorHandler.js';
import { clamp } from '../../../engine/utils/MathUtils.js';
import { EffectService } from '../services/EffectService.js';
import { QueryService } from '../services/QueryService.js';

/**
 * 戦闘計算戦略の基底クラス
 */
export class CombatStrategy {
    calculateEvasionChance(params) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDefenseChance(params) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateCriticalChance(params) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDamage(params) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateSpeedMultiplier(params) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateGaugeUpdate(params) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    resolveHitOutcome(params) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
}

/**
 * デフォルトの計算戦略
 */
class DefaultCombatStrategy extends CombatStrategy {
    
    /**
     * 回避率計算
     * @param {object} params
     * @param {number} params.mobility - 防御側の機動値 (補正込み)
     * @param {number} params.attackerSuccess - 攻撃側の成功値 (補正込み)
     */
    calculateEvasionChance({ mobility, attackerSuccess }) {
        const formula = CONFIG.FORMULAS.EVASION;
        const mobilityAdvantage = mobility - attackerSuccess;
        const evasionChance = mobilityAdvantage / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
        
        return clamp(evasionChance, 0, formula.MAX_CHANCE);
    }

    /**
     * 防御発生率計算
     * @param {object} params
     * @param {number} params.armor - 防御側の装甲/防御値 (補正込み)
     */
    calculateDefenseChance({ armor }) {
        const formula = CONFIG.FORMULAS.DEFENSE;
        const defenseChance = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;

        return clamp(defenseChance, 0, formula.MAX_CHANCE);
    }

    /**
     * クリティカル率計算
     * @param {object} params
     * @param {number} params.success - 攻撃側の成功値 (補正込み)
     * @param {number} params.mobility - 防御側の機動値 (補正込み)
     * @param {number} params.bonusChance - 特性などによる追加確率 (0.0 - 1.0)
     */
    calculateCriticalChance({ success, mobility, bonusChance = 0 }) {
        const successAdvantage = Math.max(0, success - mobility);
        const config = CONFIG.CRITICAL_HIT;
        const baseChance = successAdvantage / config.DIFFERENCE_FACTOR;
        
        return clamp(baseChance + bonusChance, 0, 1);
    }

    /**
     * ダメージ計算
     * @param {object} params
     * @param {number} params.effectiveBaseVal - 攻撃の命中/成功ステータス値 (補正込み)
     * @param {number} params.effectivePowerVal - 攻撃の威力ステータス値 (補正込み)
     * @param {number} params.mobility - 防御側の機動値 (補正込み)
     * @param {number} params.totalDefense - 防御側の防御値合計 (補正込み)
     * @param {boolean} params.isCritical
     * @param {boolean} params.isDefenseBypassed
     */
    calculateDamage({ effectiveBaseVal, effectivePowerVal, mobility, totalDefense, isCritical = false, isDefenseBypassed = false }) {
        // ダメージベース値の計算
        let damageBase;
        if (isCritical) {
            // クリティカル時は防御・回避ステータスを無視（基本値がそのまま通る）
            damageBase = Math.max(0, effectiveBaseVal);
        } else {
            const effectiveDefense = isDefenseBypassed ? 0 : totalDefense;
            damageBase = Math.max(0, effectiveBaseVal - mobility - effectiveDefense);
        }

        // 最終ダメージ計算 (基本ダメージ + 威力)
        let finalDamage = Math.floor(damageBase / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + effectivePowerVal;
        
        // クリティカル時の倍率補正
        if (isCritical) {
            finalDamage = Math.floor(finalDamage * CONFIG.FORMULAS.DAMAGE.CRITICAL_MULTIPLIER);
        }

        return finalDamage;
    }

    /**
     * 速度倍率計算
     * @param {object} params
     * @param {number} params.might - パーツ威力
     * @param {number} params.success - パーツ成功
     * @param {string} params.factorType - 'charge' | 'cooldown'
     * @param {number} params.modifier - 特性などによる補正倍率 (デフォルト 1.0)
     */
    calculateSpeedMultiplier({ might, success, factorType, modifier = 1.0 }) {
        const config = CONFIG.TIME_ADJUSTMENT;
        const impactFactor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;
        
        const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
        const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
        
        const performanceScore = mightScore + successScore;
        
        let multiplier = 1.0 + (performanceScore * impactFactor);
        
        // 補正を適用
        multiplier *= modifier;

        return multiplier;
    }

    /**
     * ゲージ更新量計算
     * @param {object} params
     * @param {number} params.currentSpeed
     * @param {number} params.mobility
     * @param {number} params.propulsion
     * @param {number} params.speedMultiplier
     * @param {number} params.deltaTime
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
        
        const increment = (nextSpeed / speedMultiplier) * timeFactor;

        return { nextSpeed, increment };
    }

    /**
     * 命中・クリティカル・防御の判定を一括で行う
     * @param {object} params
     * @param {boolean} params.isSupport - 支援行動かどうか
     * @param {number} params.evasionChance - 回避率 (0.0-1.0)
     * @param {number} params.criticalChance - クリティカル率 (0.0-1.0)
     * @param {number} params.defenseChance - 防御発生率 (0.0-1.0)
     * @param {string} params.initialTargetPartKey - 本来のターゲットパーツ
     * @param {string|null} params.bestDefensePartKey - 防御時に身代わりとなるパーツ (nullなら防御不可)
     */
    resolveHitOutcome({ isSupport, evasionChance, criticalChance, defenseChance, initialTargetPartKey, bestDefensePartKey }) {
        const defaultOutcome = { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };

        // 支援行動は必中扱い
        if (isSupport) {
            return { ...defaultOutcome, isHit: true };
        }

        // 1. 回避判定
        const isEvaded = Math.random() < evasionChance;
        if (isEvaded) {
            return defaultOutcome;
        }

        // 2. クリティカル判定
        const isCritical = Math.random() < criticalChance;
        if (isCritical) {
            return { ...defaultOutcome, isHit: true, isCritical: true };
        }

        // 3. 防御判定
        const isDefended = Math.random() < defenseChance;
        if (isDefended && bestDefensePartKey) {
            return { ...defaultOutcome, isHit: true, isDefended: true, finalTargetPartKey: bestDefensePartKey };
        }

        // 4. 通常ヒット
        return { ...defaultOutcome, isHit: true };
    }
}

/**
 * CombatCalculator シングルトン
 */
export const CombatCalculator = {
    strategy: new DefaultCombatStrategy(),

    setStrategy(newStrategy) {
        if (newStrategy instanceof CombatStrategy) {
            this.strategy = newStrategy;
        } else {
            console.warn('Invalid combat strategy provided.');
        }
    },

    calculateEvasionChance(params) { return this.strategy.calculateEvasionChance(params); },
    calculateDefenseChance(params) { return this.strategy.calculateDefenseChance(params); },
    calculateCriticalChance(params) { return this.strategy.calculateCriticalChance(params); },
    calculateDamage(params) { return this.strategy.calculateDamage(params); },
    calculateSpeedMultiplier(params) { return this.strategy.calculateSpeedMultiplier(params); },
    calculateGaugeUpdate(params) { return this.strategy.calculateGaugeUpdate(params); },
    resolveHitOutcome(params) { return this.strategy.resolveHitOutcome(params); },

    /**
     * Contextから戦闘計算に必要なパラメータを抽出する
     * @param {object} ctx - 戦闘コンテキスト
     * @returns {object} 計算用パラメータ
     */
    getCombatParamsFromContext(ctx) {
        const { attackingPart, attackerId, attackerParts, finalTargetId, targetLegs } = ctx;

        if (!finalTargetId || !targetLegs) {
            // ターゲットがいない場合は基本的なパラメータを返す
            return {
                isSupport: ctx.isSupport,
                evasionChance: 0,
                criticalChance: 0,
                defenseChance: 0,
                initialTargetPartKey: ctx.finalTargetPartKey,
                bestDefensePartKey: null
            };
        }

        const calcParams = attackingPart.effects?.find(e => e.type === 'DAMAGE')?.calculation || {};
        const baseStatKey = calcParams.baseStat || 'success';
        const defenseStatKey = calcParams.defenseStat || 'armor';

        const attackerSuccess = EffectService.getStatModifier(ctx.world, attackerId, baseStatKey, {
            attackingPart: attackingPart,
            attackerLegs: attackerParts.legs
        }) + (attackingPart[baseStatKey] || 0);

        const targetMobility = (targetLegs.mobility || 0);

        const evasionChance = this.calculateEvasionChance({
            mobility: targetMobility,
            attackerSuccess: attackerSuccess
        });

        const bonusChance = EffectService.getCriticalChanceModifier(attackingPart);
        const criticalChance = this.calculateCriticalChance({
            success: attackerSuccess,
            mobility: targetMobility,
            bonusChance: bonusChance
        });

        const targetArmor = (targetLegs[defenseStatKey] || 0);
        const defenseChance = this.calculateDefenseChance({
            armor: targetArmor
        });

        const bestDefensePartKey = QueryService.findBestDefensePart(ctx.world, finalTargetId);

        return {
            isSupport: ctx.isSupport,
            evasionChance,
            criticalChance,
            defenseChance,
            initialTargetPartKey: ctx.finalTargetPartKey,
            bestDefensePartKey
        };
    },

    /**
     * Contextからパラメータを抽出し、命中判定を実行する
     * @param {object} ctx - 戦闘コンテキスト
     * @returns {object} 判定結果
     */
    calculateHitOutcomeFromContext(ctx) {
        const params = this.getCombatParamsFromContext(ctx);
        return this.resolveHitOutcome(params);
    }
};