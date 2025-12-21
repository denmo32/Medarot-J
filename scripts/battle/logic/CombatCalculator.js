/**
 * @file CombatCalculator.js
 * @description 純粋な戦闘計算式ロジック
 */

import { CONFIG } from '../common/config.js';
import { GameError, ErrorType } from '../../../engine/utils/ErrorHandler.js';
import { clamp } from '../../../engine/utils/MathUtils.js';
import { StatCalculator } from './StatCalculator.js';
import { BattleQueries } from '../queries/BattleQueries.js';

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
    
    calculateEvasionChance({ mobility, attackerSuccess }) {
        const formula = CONFIG.FORMULAS.EVASION;
        const mobilityAdvantage = mobility - attackerSuccess;
        const evasionChance = mobilityAdvantage / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
        
        return clamp(evasionChance, 0, formula.MAX_CHANCE);
    }

    calculateDefenseChance({ armor }) {
        const formula = CONFIG.FORMULAS.DEFENSE;
        const defenseChance = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;

        return clamp(defenseChance, 0, formula.MAX_CHANCE);
    }

    calculateCriticalChance({ success, mobility, bonusChance = 0 }) {
        const successAdvantage = Math.max(0, success - mobility);
        const config = CONFIG.CRITICAL_HIT;
        const baseChance = successAdvantage / config.DIFFERENCE_FACTOR;
        
        return clamp(baseChance + bonusChance, 0, 1);
    }

    calculateDamage({ effectiveBaseVal, effectivePowerVal, mobility, totalDefense, isCritical = false, isDefenseBypassed = false }) {
        let damageBase;
        if (isCritical) {
            damageBase = Math.max(0, effectiveBaseVal);
        } else {
            const effectiveDefense = isDefenseBypassed ? 0 : totalDefense;
            damageBase = Math.max(0, effectiveBaseVal - mobility - effectiveDefense);
        }

        let finalDamage = Math.floor(damageBase / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + effectivePowerVal;
        
        if (isCritical) {
            finalDamage = Math.floor(finalDamage * CONFIG.FORMULAS.DAMAGE.CRITICAL_MULTIPLIER);
        }

        return finalDamage;
    }

    calculateSpeedMultiplier({ might, success, factorType, modifier = 1.0 }) {
        const config = CONFIG.TIME_ADJUSTMENT;
        const impactFactor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;
        
        const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
        const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
        
        const performanceScore = mightScore + successScore;
        
        let multiplier = 1.0 + (performanceScore * impactFactor);
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

    resolveHitOutcome({ isSupport, evasionChance, criticalChance, defenseChance, initialTargetPartKey, bestDefensePartKey }) {
        const defaultOutcome = { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };

        if (isSupport) {
            return { ...defaultOutcome, isHit: true };
        }

        const isEvaded = Math.random() < evasionChance;
        if (isEvaded) {
            return defaultOutcome;
        }

        const isCritical = Math.random() < criticalChance;
        if (isCritical) {
            return { ...defaultOutcome, isHit: true, isCritical: true };
        }

        const isDefended = Math.random() < defenseChance;
        if (isDefended && bestDefensePartKey) {
            return { ...defaultOutcome, isHit: true, isDefended: true, finalTargetPartKey: bestDefensePartKey };
        }

        return { ...defaultOutcome, isHit: true };
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

    calculateEvasionChance(params) { return this.strategy.calculateEvasionChance(params); },
    calculateDefenseChance(params) { return this.strategy.calculateDefenseChance(params); },
    calculateCriticalChance(params) { return this.strategy.calculateCriticalChance(params); },
    calculateDamage(params) { return this.strategy.calculateDamage(params); },
    calculateSpeedMultiplier(params) { return this.strategy.calculateSpeedMultiplier(params); },
    calculateGaugeUpdate(params) { return this.strategy.calculateGaugeUpdate(params); },
    resolveHitOutcome(params) { return this.strategy.resolveHitOutcome(params); },

    // 旧 getCombatParamsFromContext, calculateHitOutcomeFromContext は CombatParameterBuilder.js の関数に移行
};