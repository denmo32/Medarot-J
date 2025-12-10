/**
 * @file GlitchEffect.js
 * @description 妨害効果の定義
 * 副作用排除版。
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

        if (targetState.state === PlayerStateType.SELECTED_CHARGING || targetState.state === PlayerStateType.GUARDING) {
            wasSuccessful = true;
        }

        return {
            type: EffectType.APPLY_GLITCH,
            targetId: targetId,
            wasSuccessful: wasSuccessful,
        };
    },

    // 適用データ生成フェーズ
    apply: ({ world, effect }) => {
        const events = [];
        const stateUpdates = [];
        
        if (effect.wasSuccessful) {
            // イベントの発行は System で処理されるため、データとして返す
            events.push({
                type: GameEvents.ACTION_CANCELLED,
                payload: { 
                    entityId: effect.targetId, 
                    reason: ActionCancelReason.INTERRUPTED 
                }
            });
            events.push({
                type: GameEvents.REQUEST_RESET_TO_COOLDOWN,
                payload: {
                    entityId: effect.targetId,
                    options: { interrupted: true }
                }
            });
            // 状態更新は REQUEST_RESET_TO_COOLDOWN イベントを受けたシステムが行うため
            // ここでの stateUpdates は空でも動作するが、イベントの発行順序に依存する。
            // 厳密にはここでの状態更新ロジックを stateUpdates に含めるべきだが、
            // 既存の CooldownService を利用するイベントベースのフローを維持する。
        }
        
        return { ...effect, events, stateUpdates };
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