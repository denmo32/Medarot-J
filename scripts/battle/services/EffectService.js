/**
 * @file EffectService.js
 * @description ステータス補正サービス。
 * パーツデータの参照方法を修正。
 */
import { ActiveEffects } from '../components/index.js';
import { EffectType } from '../common/constants.js';
import { TypeDefinitions } from '../../data/typeDefinitions.js';
import { TraitDefinitions } from '../../data/traitDefinitions.js';
import { TraitRegistry } from '../definitions/traits/TraitRegistry.js';

export class EffectService {
    
    static getStatModifier(world, entityId, statName, context = {}) {
        const fullContext = {
            ...context,
            world,
            entityId,
            targetStat: statName,
            currentVal: 0 
        };

        let modifier = 0;
        modifier += this._executeTraitHooks('onCalculateStat', fullContext);
        modifier += this._getActiveEffectModifier(world, entityId, statName);

        return modifier;
    }

    static getSpeedMultiplierModifier(world, entityId, part) {
        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (activeEffects) {
            if (activeEffects.effects.some(e => e.type === 'STOP_GAUGE')) {
                return 0;
            }
        }

        const context = { world, entityId, part, attackingPart: part };
        let multiplier = 1.0;

        const factors = this._executeTraitHooks('onCalculateSpeedMultiplier', context, true);
        
        if (factors.length > 0) {
            multiplier = factors.reduce((acc, val) => acc * val, 1.0);
        }

        return multiplier;
    }

    static getCriticalChanceModifier(part) {
        if (!part) return 0;
        const context = { attackingPart: part };
        
        // パーツデータ(part)はQueryService経由で取得されたオブジェクトである前提
        // その中に criticalBonus が含まれている場合、それを優先または加算
        let traitBonus = this._executeTraitHooks('onCalculateCritical', context);
        return traitBonus + (part.criticalBonus || 0);
    }

    // --- Internal Logic ---

    static _executeTraitHooks(hookName, context, returnArray = false) {
        const { attackingPart } = context;
        if (!attackingPart) return returnArray ? [] : 0;

        const results = [];
        let total = 0;

        // attackingPartには trait 文字列や actionType が含まれている
        const definitions = [
            TypeDefinitions[attackingPart.actionType], // ActionType (SHOOT etc)
            // TraitDefinitions は実装未完了だが、あれば参照
            // TraitDefinitions[attackingPart.trait]
        ];

        for (const def of definitions) {
            if (!def) continue;

            if (hookName === 'onCalculateStat' && def.statModifiers) {
                const logic = TraitRegistry.getLogic('STAT_MODIFIER');
                if (logic) {
                    for (const mod of def.statModifiers) {
                        const val = logic.onCalculateStat(context, mod);
                        if (val !== 0) {
                            results.push(val);
                            total += val;
                        }
                    }
                }
            }

            if (def.logic) {
                const logicImpl = TraitRegistry.getLogic(def.logic);
                if (logicImpl && typeof logicImpl[hookName] === 'function') {
                    const val = logicImpl[hookName](context, def.params || {});
                    results.push(val);
                    total += val;
                }
            }
            
            if (hookName === 'onCalculateSpeedMultiplier' && def.speedMultiplier !== undefined) {
                results.push(def.speedMultiplier);
            }
            if (hookName === 'onCalculateCritical' && def.criticalBonus !== undefined) {
                results.push(def.criticalBonus);
                total += def.criticalBonus;
            }
        }

        return returnArray ? results : total;
    }

    static _getActiveEffectModifier(world, entityId, statName) {
        let bonus = 0;
        if (!world || entityId === undefined || entityId === null) return 0;

        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (!activeEffects) return 0;

        if (statName === 'success') {
            const scanEffects = activeEffects.effects.filter(e => e.type === EffectType.APPLY_SCAN);
            bonus += scanEffects.reduce((sum, e) => sum + e.value, 0);
        }

        return bonus;
    }
}