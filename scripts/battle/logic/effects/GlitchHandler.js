/**
 * @file GlitchHandler.js
 * @description 妨害付与 (APPLY_GLITCH) のロジック。
 */
import { EffectHandler } from './EffectHandler.js';
import { IsCharging, IsGuarding } from '../../components/index.js'; // Battle
import { EffectType, ActionCancelReason } from '../../common/constants.js';
import { ActionCancelledRequest } from '../../../components/Events.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';

export class GlitchHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { targetId } = context;

        if (!targetId) {
            this.finish(world, effectEntityId, { type: EffectType.APPLY_GLITCH, wasSuccessful: false });
            return;
        }

        const isCharging = world.getComponent(targetId, IsCharging);
        const isGuarding = world.getComponent(targetId, IsGuarding);
        
        // 充填中またはガード中の相手にのみ成功する
        const wasSuccessful = !!(isCharging || isGuarding);

        const stateUpdates = [];

        if (wasSuccessful) {
            const cancelRequestEntity = world.createEntity();
            world.addComponent(cancelRequestEntity, new ActionCancelledRequest({
                entityId: targetId,
                reason: ActionCancelReason.INTERRUPTED
            }));

            stateUpdates.push({
                type: 'ResetToCooldown',
                targetId: targetId,
                options: { interrupted: true }
            });
        }

        this.finish(world, effectEntityId, {
            type: EffectType.APPLY_GLITCH,
            targetId,
            wasSuccessful,
            stateUpdates
        });
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.APPLY_GLITCH];
        const messageKey = resultData.wasSuccessful ? def.keys.success : def.keys.failed;
        return { messageKey };
    }
}