/**
 * @file EffectService.js
 * @description 戦闘におけるステータス補正や特性効果を一元管理するサービス。
 */
import { ActiveEffects } from '../components/index.js';
import { EffectType } from '../common/constants.js';
import { TypeDefinitions } from '../../data/typeDefinitions.js';
import { TraitDefinitions } from '../../data/traitDefinitions.js';
import { TraitRegistry } from '../definitions/traits/TraitRegistry.js';

export class EffectService {
    
    /**
     * 指定されたステータスに対する補正値を取得する
     */
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

    /**
     * 速度係数に対する補正を取得する
     */
    static getSpeedMultiplierModifier(world, entityId, part) {
        // 1. 強制停止状態のチェック（拡張用）
        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (activeEffects) {
            // 例: 'STOP_GAUGE' エフェクトがある場合は 0 を返す
            if (activeEffects.effects.some(e => e.type === 'STOP_GAUGE')) {
                return 0;
            }
        }

        // 2. 補正計算
        const context = { world, entityId, part, attackingPart: part };
        let multiplier = 1.0;

        const factors = this._executeTraitHooks('onCalculateSpeedMultiplier', context, true);
        
        if (factors.length > 0) {
            multiplier = factors.reduce((acc, val) => acc * val, 1.0);
        }

        return multiplier;
    }

    /**
     * クリティカル率への補正を取得する
     */
    static getCriticalChanceModifier(part) {
        if (!part) return 0;
        const context = { attackingPart: part };
        
        return this._executeTraitHooks('onCalculateCritical', context);
    }

    // --- Internal Logic ---

    static _executeTraitHooks(hookName, context, returnArray = false) {
        const { attackingPart } = context;
        if (!attackingPart) return returnArray ? [] : 0;

        const results = [];
        let total = 0;

        const definitions = [
            TypeDefinitions[attackingPart.type],
            TraitDefinitions[attackingPart.trait]
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