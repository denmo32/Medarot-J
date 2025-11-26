/**
 * @file 戦闘計算式ユーティリティ
 */

import { CONFIG } from '../../config/gameConfig.js';
import { Gauge } from '../components/Gauge.js';
import { Parts } from '../../models/Parts.js';
import { ActiveEffects } from '../components/ActiveEffects.js';
import { findBestDefensePart } from './queryUtils.js';
import { GameError, ErrorType } from '../../../engine/utils/ErrorHandler.js';
import { EffectType, AttackType } from '../../config/constants.js';
import { clamp } from '../../../engine/utils/MathUtils.js'; // PascalCase

export class CombatStrategy {
    calculateEvasionChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDefenseChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateCriticalChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDamage(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateSpeedMultiplier(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateGaugeIncrement(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
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

    calculateGaugeIncrement({ world, entityId, deltaTime }) {
        if (!world || entityId === undefined) return 0;

        const gauge = world.getComponent(entityId, Gauge);
        const parts = world.getComponent(entityId, Parts);
        
        if (!gauge || !parts) return 0;
        
        const propulsion = parts.legs?.propulsion || 1;
        const speedMultiplier = gauge.speedMultiplier || 1.0;
        
        const baseIncrement = (propulsion / CONFIG.FORMULAS.GAUGE.GAUGE_INCREMENT_DIVISOR);
        const timeFactor = (deltaTime / CONFIG.UPDATE_INTERVAL);
        
        return (baseIncrement * timeFactor) / speedMultiplier;
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
            .filter(e => e.type === EffectType.APPLY_SCAN)
            .reduce((total, e) => total + e.value, 0);
    }

    _calculateTypeBonus(attackType, attackerLegs) {
        let successBonus = 0;
        let mightBonus = 0;

        if (!attackerLegs) return { successBonus, mightBonus };

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
    calculateGaugeIncrement(context) { return this.strategy.calculateGaugeIncrement(context); },
    resolveHitOutcome(context) { return this.strategy.resolveHitOutcome(context); }
};