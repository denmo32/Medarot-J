/**
 * @file GuardEffect.js
 * @description ガード効果の定義
 */
import { EffectType } from '../../../common/constants.js';
import { ActiveEffects } from '../../components/index.js';
import { PlayerStateType, ModalType } from '../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';

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

        // 状態遷移コマンドを追加
        stateUpdates.push({
            type: 'TRANSITION_STATE',
            targetId: effect.targetId,
            newState: PlayerStateType.GUARDING
        });

        // ActiveEffectsの更新コマンドを追加
        stateUpdates.push({
            type: 'CUSTOM_UPDATE',
            targetId: effect.targetId,
            componentType: ActiveEffects,
            customHandler: (activeEffects) => {
                // エフェクト配列の更新
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
    },

    createVisuals: ({ world, effects, messageGenerator }) => {
        const visuals = [];
        for (const effect of effects) {
            const message = messageGenerator.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
            visuals.push({
                type: 'DIALOG',
                text: message,
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
        }
        return visuals;
    }
};