/**
 * @file EffectService.js
 * @description ステータス補正サービス。
 * TraitRegistry を使用するように修正。
 */
import { ActiveEffects } from '../components/index.js'; // Battle
import { EffectType } from '../common/constants.js';
import { TypeDefinitions } from '../../data/typeDefinitions.js';
import { TraitRegistry } from '../definitions/traits/TraitRegistry.js';
import { HookPhase } from '../definitions/HookRegistry.js';

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
        modifier += this._executeTraitHooks(HookPhase.ON_CALCULATE_STAT, fullContext);
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

        const factors = this._executeTraitHooks(HookPhase.ON_CALCULATE_SPEED_MULTIPLIER, context, true);
        
        if (factors.length > 0) {
            multiplier = factors.reduce((acc, val) => acc * val, 1.0);
        }

        return multiplier;
    }

    static getCriticalChanceModifier(part) {
        if (!part) return 0;
        const context = { attackingPart: part };
        
        let traitBonus = this._executeTraitHooks(HookPhase.ON_CALCULATE_CRITICAL, context);
        return traitBonus + (part.criticalBonus || 0);
    }

    // --- Internal Logic ---

    static _executeTraitHooks(hookName, context, returnArray = false) {
        const { attackingPart } = context;
        if (!attackingPart) return returnArray ? [] : 0;

        const results = [];
        let total = 0;

        const definitions = [
            TypeDefinitions[attackingPart.type],
            // 将来的に: TraitDefinitions[attackingPart.trait]
        ];

        for (const def of definitions) {
            if (!def) continue;

            if (hookName === HookPhase.ON_CALCULATE_STAT && def.statModifiers) {
                // STAT_MODIFIER トレイトを呼び出し
                for (const mod of def.statModifiers) {
                    const val = TraitRegistry.executeTraitLogic('STAT_MODIFIER', hookName, { ...context, params: mod });
                    if (val !== 0) {
                        results.push(val);
                        total += val;
                    }
                }
            }

            // TypeDefinition自体が Trait パラメータを持っている場合 (speedMultiplier, criticalBonus)
            // これも汎用 STAT_MODIFIER トレイトで処理可能だが、パラメータ形式を合わせる
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