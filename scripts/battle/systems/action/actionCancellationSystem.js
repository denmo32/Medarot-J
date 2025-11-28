import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { GameState, Action } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { PlayerStateType, ActionCancelReason } from '../../common/constants.js';

export class ActionCancellationSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }

    onHpBarAnimationCompleted(detail) {
        const { appliedEffects } = detail;
        if (!appliedEffects) return;

        for (const effect of appliedEffects) {
            if (!effect.isPartBroken) continue;

            const { targetId: brokenEntityId, partKey: brokenPartKey } = effect;

            const actors = this.getEntities(GameState, Action, Parts);
            for (const actorId of actors) {
                const gameState = this.world.getComponent(actorId, GameState);
                if (gameState.state !== PlayerStateType.SELECTED_CHARGING) {
                    continue;
                }

                const action = this.world.getComponent(actorId, Action);
                const actorParts = this.world.getComponent(actorId, Parts);
                const selectedPart = actorParts[action.partKey];

                if (actorId === brokenEntityId && action.partKey === brokenPartKey) {
                    this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: ActionCancelReason.PART_BROKEN });
                    this.world.emit(GameEvents.REQUEST_RESET_TO_COOLDOWN, { entityId: actorId, options: { interrupted: true } });
                    continue;
                }
                
                if (effect.isPlayerBroken && selectedPart && selectedPart.targetScope?.endsWith('_SINGLE') && action.targetId === brokenEntityId) {
                    this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: ActionCancelReason.TARGET_LOST });
                    this.world.emit(GameEvents.REQUEST_RESET_TO_COOLDOWN, { entityId: actorId, options: { interrupted: true } });
                    continue;
                }

                if (selectedPart && selectedPart.targetScope?.endsWith('_SINGLE') && action.targetId === brokenEntityId && action.targetPartKey === brokenPartKey) {
                    this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: ActionCancelReason.TARGET_LOST });
                    this.world.emit(GameEvents.REQUEST_RESET_TO_COOLDOWN, { entityId: actorId, options: { interrupted: true } });
                    continue;
                }
            }
        }
    }
}