/**
 * @file GuardEffect.js
 * @description ガード効果の定義
 * createVisualsメソッドは削除され、VisualSequenceServiceとVisualDefinitionsに責務が移譲されました。
 */
import { EffectType, PlayerStateType } from '../../common/constants.js';
import { ActiveEffects } from '../../components/index.js';

export const GuardEffect = {
    type: EffectType.APPLY_GUARD,

    process: ({ world, sourceId, effect, part, partKey }) => {
        const params = effect.params || {};
        const countSource = params.countSource || 'might';
        const countFactor = params.countFactor || 0.1;
        
        const baseValue = part[countSource] || 0;
        const guardCount = Math.floor(baseValue * countFactor);
        
        return {
            type: EffectType.APPLY_GUARD,
            targetId: sourceId,
            value: guardCount,
            partKey: partKey,
        };
    },

    apply: ({ world, effect }) => {
        const stateUpdates = [];

        stateUpdates.push({
            type: 'TransitionState',
            targetId: effect.targetId,
            newState: PlayerStateType.GUARDING
        });

        stateUpdates.push({
            type: 'CustomUpdateComponent',
            targetId: effect.targetId,
            componentType: ActiveEffects,
            customHandler: (activeEffects) => {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                activeEffects.effects.push({
                    type: EffectType.APPLY_GUARD,
                    value: effect.value,
                    count: effect.value,
                    partKey: effect.partKey,
                    duration: Infinity
                });
            }
        });

        return { ...effect, events: [], stateUpdates };
    }
};