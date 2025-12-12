import { System } from '../../../../engine/core/System.js';
import { TurnContext } from '../../components/TurnContext.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, Gauge } from '../../components/index.js';
import { PlayerStateType } from '../../common/constants.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectService } from '../../services/EffectService.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';

export class ActionSelectionSystem extends System {
    constructor(world) {
        super(world);
        this.turnContext = this.world.getSingletonComponent(TurnContext);

        this.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.on(GameEvents.NEXT_ACTOR_DETERMINED, this.onNextActorDetermined.bind(this));
    }

    update(deltaTime) {
        // ポーリングによる完了チェックは削除
        // 完了判定は ActionSelectionState に移譲されたため
    }

    onNextActorDetermined(detail) {
        const { entityId } = detail;
        this.turnContext.currentActorId = entityId;
        this.triggerActionSelection(entityId);
    }

    triggerActionSelection(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const eventToEmit = playerInfo.teamId === 'team1'
            ? GameEvents.PLAYER_INPUT_REQUIRED
            : GameEvents.AI_ACTION_REQUIRED;

        this.world.emit(eventToEmit, { entityId });
    }

    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;

        if (this.turnContext.currentActorId === entityId) {
            this.turnContext.selectedActions.set(entityId, detail);
            this.turnContext.currentActorId = null;
        }

        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (!partKey || !parts?.[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionSelectionSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const selectedPart = parts[partKey];

        action.partKey = partKey;
        action.type = selectedPart.action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        action.targetTiming = selectedPart.targetTiming;

        const modifier = EffectService.getSpeedMultiplierModifier(this.world, entityId, selectedPart);
        const speedMultiplier = CombatCalculator.calculateSpeedMultiplier({
            might: selectedPart.might,
            success: selectedPart.success,
            factorType: 'charge',
            modifier: modifier
        });

        const commands = [
            createCommand('TRANSITION_STATE', {
                targetId: entityId,
                newState: PlayerStateType.SELECTED_CHARGING
            }),
            createCommand('UPDATE_COMPONENT', {
                targetId: entityId,
                componentType: Gauge,
                updates: {
                    value: 0,
                    currentSpeed: 0,
                    speedMultiplier: speedMultiplier
                }
            })
        ];
        CommandExecutor.executeCommands(this.world, commands);

        // 完了通知は不要（Stateがポーリングするため）
        // this.world.emit(GameEvents.ACTION_SELECTION_COMPLETED);
    }
}