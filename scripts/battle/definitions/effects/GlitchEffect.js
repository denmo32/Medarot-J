/**
 * @file GlitchEffect.js
 * @description 妨害効果の定義。
 * 状態判定をタグコンポーネント(IsCharging, IsGuarding)に変更。
 */
import { EffectType, ActionCancelReason } from '../../common/constants.js';
import { PlayerInfo } from '../../../components/index.js';
import { IsCharging, IsGuarding } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';

export const GlitchEffect = {
    type: EffectType.APPLY_GLITCH,

    process: ({ world, targetId }) => {
        if (targetId === null || targetId === undefined) return null;

        const targetInfo = world.getComponent(targetId, PlayerInfo);
        if (!targetInfo) return null;

        // IsCharging(前進中) または IsGuarding(ガード中) なら成功
        // 注意: ActionSelectionSystemで設定される IsCharging は旧 SELECTED_CHARGING に相当
        const isCharging = world.getComponent(targetId, IsCharging);
        const isGuarding = world.getComponent(targetId, IsGuarding);

        let wasSuccessful = false;
        if (isCharging || isGuarding) {
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
            stateUpdates.push({
                type: 'ResetToCooldown',
                targetId: effect.targetId,
                options: { interrupted: true }
            });
        }
        
        return { ...effect, events, stateUpdates };
    }
};