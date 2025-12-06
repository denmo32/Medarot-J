/**
 * @file GlitchEffect.js
 * @description 妨害効果の定義
 */
import { EffectType } from '../../../common/constants.js';
import { PlayerInfo } from '../../../components/index.js';
import { GameState } from '../../components/index.js';
import { PlayerStateType, ModalType, ActionCancelReason } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { createDialogTask } from '../../tasks/BattleTasks.js';
import { MessageKey } from '../../../data/messageRepository.js';

export const GlitchEffect = {
    type: EffectType.APPLY_GLITCH,

    // 計算フェーズ
    process: ({ world, targetId }) => {
        if (targetId === null || targetId === undefined) return null;

        const targetInfo = world.getComponent(targetId, PlayerInfo);
        const targetState = world.getComponent(targetId, GameState);
        if (!targetInfo || !targetState) return null;

        let wasSuccessful = false;

        // 充填中またはガード中の相手にのみ成功
        if (targetState.state === PlayerStateType.SELECTED_CHARGING || targetState.state === PlayerStateType.GUARDING) {
            wasSuccessful = true;
        }

        return {
            type: EffectType.APPLY_GLITCH,
            targetId: targetId,
            wasSuccessful: wasSuccessful,
        };
    },

    // 適用フェーズ
    apply: ({ world, effect }) => {
        const events = [];
        
        if (effect.wasSuccessful) {
            events.push({
                type: GameEvents.ACTION_CANCELLED,
                payload: { 
                    entityId: effect.targetId, 
                    reason: ActionCancelReason.INTERRUPTED 
                }
            });
            // 冷却へ強制移行
            events.push({
                type: GameEvents.REQUEST_RESET_TO_COOLDOWN,
                payload: {
                    entityId: effect.targetId,
                    options: { interrupted: true }
                }
            });
        }
        
        return { ...effect, events };
    },

    // 演出フェーズ
    createTasks: ({ world, effects, messageGenerator }) => {
        const tasks = [];
        for (const effect of effects) {
            const targetInfo = world.getComponent(effect.targetId, PlayerInfo);
            const key = effect.wasSuccessful ? MessageKey.INTERRUPT_GLITCH_SUCCESS : MessageKey.INTERRUPT_GLITCH_FAILED;
            const message = messageGenerator.format(key, { targetName: targetInfo?.name || '相手' });
            
            tasks.push(createDialogTask(message, { modalType: ModalType.EXECUTION_RESULT }));
        }
        return tasks;
    }
};