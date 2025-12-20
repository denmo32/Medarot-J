/**
 * @file GuardHandler.js
 * @description ガード付与 (APPLY_GUARD) のロジック。
 */
import { EffectHandler } from './EffectHandler.js';
import { ActiveEffects, Action } from '../../components/index.js'; // Battle
import { EffectType, PlayerStateType } from '../../common/constants.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';

export class GuardHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { targetId, partKey, attackingPart } = context;

        const params = effect.params || {};
        const countSource = params.countSource || 'might';
        const countFactor = params.countFactor || 0.1;
        
        const baseValue = attackingPart[countSource] || 0;
        const guardCount = Math.floor(baseValue * countFactor);

        const action = world.getComponent(targetId, Action);
        const actualPartKey = action && action.partKey ? action.partKey : partKey;

        const stateUpdates = [];
        stateUpdates.push({
            type: 'TransitionState',
            targetId: targetId,
            newState: PlayerStateType.GUARDING 
        });

        stateUpdates.push({
            type: 'CustomUpdateComponent',
            targetId: targetId,
            componentType: ActiveEffects,
            customHandler: (activeEffects) => {
                // 既存のガード効果があれば上書き
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                activeEffects.effects.push({
                    type: EffectType.APPLY_GUARD,
                    value: guardCount,
                    count: guardCount,
                    partKey: actualPartKey,
                    duration: Infinity
                });
            }
        });

        this.finish(world, effectEntityId, {
            type: EffectType.APPLY_GUARD,
            targetId,
            value: guardCount, // 表示用に回数をvalueとして渡す
            stateUpdates
        });
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.APPLY_GUARD];
        return { messageKey: def.keys.default };
    }
}