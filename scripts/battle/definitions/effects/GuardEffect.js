/**
 * @file GuardEffect.js
 * @description ガード効果の定義
 * Phase 2: データ駆動化 & 副作用の制御
 */
import { EffectType } from '../../../common/constants.js';
import { ActiveEffects } from '../../components/index.js';
import { PlayerStateType, ModalType } from '../../common/constants.js';
import { PlayerStatusService } from '../../services/PlayerStatusService.js';
import { createDialogTask } from '../../tasks/BattleTasks.js';
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

        stateUpdates.push({
            type: 'CUSTOM_UPDATE',
            targetId: effect.targetId,
            componentType: ActiveEffects,
            customHandler: (activeEffects, worldInstance) => {
                // ガード状態への遷移ロジック
                // Service呼び出しは副作用を含むが、ApplyStateTask内で実行されるため
                // 実行タイミングは制御されている。
                if (worldInstance) {
                    PlayerStatusService.transitionTo(worldInstance, effect.targetId, PlayerStateType.GUARDING);
                }

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

    createTasks: ({ world, effects, messageGenerator }) => {
        const tasks = [];
        for (const effect of effects) {
            const message = messageGenerator.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
            tasks.push(createDialogTask(message, { modalType: ModalType.EXECUTION_RESULT }));
        }
        return tasks;
    }
};