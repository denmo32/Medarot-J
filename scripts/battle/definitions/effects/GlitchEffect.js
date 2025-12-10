/**
 * @file GlitchEffect.js
 * @description 妨害効果の定義
 * Phase 2: データ駆動化 (といっても更新はないのでそのまま)
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

    process: ({ world, targetId }) => {
        if (targetId === null || targetId === undefined) return null;

        const targetInfo = world.getComponent(targetId, PlayerInfo);
        const targetState = world.getComponent(targetId, GameState);
        if (!targetInfo || !targetState) return null;

        let wasSuccessful = false;
        if (targetState.state === PlayerStateType.SELECTED_CHARGING || targetState.state === PlayerStateType.GUARDING) {
            wasSuccessful = true;
        }

        return {
            type: EffectType.APPLY_GLITCH,
            targetId: targetId,
            wasSuccessful: wasSuccessful,
        };
    },

    apply: ({ world, effect }) => {
        const events = [];
        const stateUpdates = [];
        
        if (effect.wasSuccessful) {
            events.push({
                type: GameEvents.ACTION_CANCELLED,
                payload: { 
                    entityId: effect.targetId, 
                    reason: ActionCancelReason.INTERRUPTED 
                }
            });
            // REQUEST_RESET_TO_COOLDOWN イベントの代わりにコマンドを生成
            stateUpdates.push({
                type: 'RESET_TO_COOLDOWN',
                targetId: effect.targetId,
                options: { interrupted: true }
            });
        }
        
        return { ...effect, events, stateUpdates };
    },

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