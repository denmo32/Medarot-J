/**
 * @file StatCalculator.js
 * @description ステータス補正計算を行うロジック関数群。
 */
import { ActiveEffects } from '../components/index.js'; 
import { EffectType } from '../common/constants.js';
import { TypeDefinitions } from '../../data/typeDefinitions.js';
import { TraitRegistry } from '../registries/TraitRegistry.js';
import { HookPhase } from '../registries/HookRegistry.js';

export const StatCalculator = {
    
    getStatModifier(world, entityId, statName, context = {}) {
        const fullContext = {
            ...context,
            world,
            entityId,
            targetStat: statName,
            currentVal: 0 
        };

        let modifier = 0;
        modifier += this._executeTraitHooks(HookPhase.ON_CALCULATE_STAT, fullContext);
        modifier += this._getActiveEffectModifier(world, entityId, statName);

        return modifier;
    },

    getSpeedMultiplierModifier(world, entityId, part) {
        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (activeEffects) {
            if (activeEffects.effects.some(e => e.type === 'STOP_GAUGE')) {
                return 0;
            }
        }

        const context = { world, entityId, part, attackingPart: part };
        let multiplier = 1.0;

        const factors = this._executeTraitHooks(HookPhase.ON_CALCULATE_SPEED_MULTIPLIER, context, true);
        
        if (factors.length > 0) {
            multiplier = factors.reduce((acc, val) => acc * val, 1.0);
        }

        return multiplier;
    },

    getCriticalChanceModifier(part) {
        if (!part) return 0;
        const context = { attackingPart: part };
        
        let traitBonus = this._executeTraitHooks(HookPhase.ON_CALCULATE_CRITICAL, context);
        return traitBonus + (part.criticalBonus || 0);
    },

    // --- Internal Logic ---

    _executeTraitHooks(hookName, context, returnArray = false) {
        const { attackingPart } = context;
        if (!attackingPart) return returnArray ? [] : 0;

        const results = [];
        let total = 0;

        const definitions = [
            TypeDefinitions[attackingPart.type],
        ];

        for (const def of definitions) {
            if (!def) continue;

            if (hookName === HookPhase.ON_CALCULATE_STAT && def.statModifiers) {
                for (const mod of def.statModifiers) {
                    const val = TraitRegistry.executeTraitLogic('STAT_MODIFIER', hookName, { ...context, params: mod });
                    if (val !== 0) {
                        results.push(val);
                        total += val;
                    }
                }
            }

            if (hookName === HookPhase.ON_CALCULATE_SPEED_MULTIPLIER && def.speedMultiplier !== undefined) {
                const val = TraitRegistry.executeTraitLogic('STAT_MODIFIER', hookName, { ...context, params: def });
                results.push(val);
            }
            
            if (hookName === HookPhase.ON_CALCULATE_CRITICAL && def.criticalBonus !== undefined) {
                const val = TraitRegistry.executeTraitLogic('STAT_MODIFIER', hookName, { ...context, params: def });
                results.push(val);
                total += val;
            }
        }

        return returnArray ? results : total;
    },

    _getActiveEffectModifier(world, entityId, statName) {
        let bonus = 0;
        if (!world || entityId === undefined || entityId === null) return 0;

        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (!activeEffects) return 0;

        // 汎用的なバフの検索: e.params.statName が要求されたステータスと一致するものを集計
        bonus += activeEffects.effects
            .filter(e => e.params?.statName === statName)
            .reduce((sum, e) => sum + e.value, 0);

        return bonus;
    }
};