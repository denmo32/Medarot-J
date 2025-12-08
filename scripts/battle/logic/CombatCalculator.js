/**
 * @file CombatCalculator.js
 * @description 戦闘計算式ロジック
 * Strategyパターンを用いて計算ロジックを抽象化。
 * 元 scripts/battle/utils/combatFormulas.js
 */

import { CONFIG } from '../common/config.js';
import { findBestDefensePart } from '../utils/queryUtils.js';
import { GameError, ErrorType } from '../../../engine/utils/ErrorHandler.js';
import { clamp } from '../../../engine/utils/MathUtils.js';
import { EffectService } from '../services/EffectService.js';
import { Parts } from '../../components/index.js';

/**
 * 戦闘計算戦略の基底クラス
 * すべてのメソッドはオーバーライド可能です。
 */
export class CombatStrategy {
    calculateEvasionChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDefenseChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateCriticalChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDamage(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateSpeedMultiplier(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateGaugeUpdate(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    resolveHitOutcome(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
}

/**
 * デフォルトの計算戦略
 */
class DefaultCombatStrategy extends CombatStrategy {
    
    /**
     * ステータス値に補正を適用して取得する共通メソッド
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} statName 
     * @param {number} baseVal 
     * @param {object} context 
     * @returns {number}
     */
    applyStatModifiers(world, entityId, statName, baseVal, context) {
        // EffectServiceを通じて、Trait/ActiveEffectsからの補正を取得
        const modifier = EffectService.getStatModifier(world, entityId, statName, context);
        return baseVal + modifier;
    }

    /**
     * 攻撃側のステータス値を取得（補正込み）
     */
    getAttackerStat(world, attackerId, statName, attackingPart, attackerLegs) {
        const baseVal = attackingPart[statName] ?? 0;
        const context = { attackingPart, attackerLegs };
        return this.applyStatModifiers(world, attackerId, statName, baseVal, context);
    }

    calculateEvasionChance({ world, attackerId, targetLegs, attackingPart, calcParams }) {
        if (!targetLegs || !attackingPart) return 0;

        const baseStat = calcParams?.baseStat || 'success';
        const mobility = targetLegs.mobility ?? 0;
        
        // 攻撃側の脚部情報を取得（存在すれば）
        let attackerLegs = null;
        if (attackerId !== undefined) {
             const attackerParts = world.getComponent(attackerId, Parts);
             if (attackerParts) attackerLegs = attackerParts.legs;
        }

        const adjustedSuccess = this.getAttackerStat(world, attackerId, baseStat, attackingPart, attackerLegs);
        
        const formula = CONFIG.FORMULAS.EVASION;
        const mobilityAdvantage = mobility - adjustedSuccess;
        const evasionChance = mobilityAdvantage / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
        
        return clamp(evasionChance, 0, formula.MAX_CHANCE);
    }

    calculateDefenseChance({ targetLegs }) {
        if (!targetLegs) return 0;
        
        const armor = targetLegs.armor || 0;
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
        
        // 特性によるクリティカル補正を取得
        const typeBonus = EffectService.getCriticalChanceModifier(attackingPart);
        
        return clamp(baseChance + typeBonus, 0, 1);
    }

    calculateDamage({ world, attackerId, attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false, calcParams }) {
        if (!attackingPart || !attackerLegs || !targetLegs) return 0;

        const baseStatKey = calcParams?.baseStat || 'success';
        const powerStatKey = calcParams?.powerStat || 'might';
        const defenseStatKey = calcParams?.defenseStat || 'armor';

        // 攻撃側の各ステータス（補正込み）を取得
        const effectiveBaseVal = this.getAttackerStat(world, attackerId, baseStatKey, attackingPart, attackerLegs);
        const effectivePowerVal = this.getAttackerStat(world, attackerId, powerStatKey, attackingPart, attackerLegs);

        // 防御側の防御力計算
        const mobility = targetLegs.mobility ?? 0;
        const defenseBase = targetLegs[defenseStatKey] ?? 0;
        const stabilityDefenseBonus = Math.floor((targetLegs.stability || 0) / 2);
        const totalDefense = defenseBase + stabilityDefenseBonus;
        
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
        // ※ ここでの計算式はゲームバランスに応じて調整可能
        let finalDamage = Math.floor(damageBase / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + effectivePowerVal;
        
        // クリティカル時の倍率補正（オプション）
        if (isCritical) {
            finalDamage = Math.floor(finalDamage * CONFIG.FORMULAS.DAMAGE.CRITICAL_MULTIPLIER);
        }

        return finalDamage;
    }

    calculateSpeedMultiplier({ world, entityId, part, factorType }) {
        if (!part) return 1.0;
        
        const config = CONFIG.TIME_ADJUSTMENT;
        const impactFactor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;
        
        const might = part.might ?? 0;
        const success = part.success ?? 0;
        
        const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
        const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
        
        const performanceScore = mightScore + successScore;
        
        let multiplier = 1.0 + (performanceScore * impactFactor);
        
        // 特性による速度補正を取得（乗算）
        const modifier = EffectService.getSpeedMultiplierModifier(world, entityId, part);
        multiplier *= modifier;

        return multiplier;
    }

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

    resolveHitOutcome({ world, attackerId, targetId, attackingPart, targetLegs, initialTargetPartKey, calcParams }) {
        const defaultOutcome = { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };

        // 支援行動は必中扱い
        if (attackingPart.isSupport) {
            return { ...defaultOutcome, isHit: true };
        }

        if (!targetId || !targetLegs) {
            return defaultOutcome;
        }

        // 1. 回避判定
        const evasionChance = this.calculateEvasionChance({ world, attackerId, targetLegs, attackingPart, calcParams });
        const isEvaded = Math.random() < evasionChance;
        
        if (isEvaded) {
            return defaultOutcome;
        }

        // 2. クリティカル判定
        const critChance = this.calculateCriticalChance({ attackingPart, targetLegs });
        const isCritical = Math.random() < critChance;

        if (isCritical) {
            return { ...defaultOutcome, isHit: true, isCritical: true };
        }

        // 3. 防御判定
        const defenseChance = this.calculateDefenseChance({ targetLegs });
        const isDefended = Math.random() < defenseChance;

        if (isDefended) {
            const defensePartKey = findBestDefensePart(world, targetId);
            if (defensePartKey) {
                return { ...defaultOutcome, isHit: true, isDefended: true, finalTargetPartKey: defensePartKey };
            }
        }

        // 4. 通常ヒット
        return { ...defaultOutcome, isHit: true };
    }
}

/**
 * CombatCalculator シングルトン
 * 計算戦略を保持し、計算要求を委譲します。
 */
export const CombatCalculator = {
    strategy: new DefaultCombatStrategy(),
    
    /**
     * 計算戦略を切り替える
     * @param {CombatStrategy} newStrategy 
     */
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