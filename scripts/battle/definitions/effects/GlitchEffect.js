/**
 * @file GlitchEffect.js
 * @description 妨害効果の定義
 * createVisualsメソッドは削除され、VisualSequenceServiceとVisualDefinitionsに責務が移譲されました。
 */
import { EffectType, PlayerStateType, ActionCancelReason } from '../../common/constants.js';
import { PlayerInfo } from '../../../components/index.js';
import { GameState } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { ResetToCooldownCommand } from '../../common/Command.js';

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
            stateUpdates.push(new ResetToCooldownCommand({
                targetId: effect.targetId,
                options: { interrupted: true }
            }));
        }
        
        return { ...effect, events, stateUpdates };
    }
};