import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../components/BattleContext.js'; 
import { BattlePhase, PlayerStateType } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, GameState, Gauge } from '../../components/index.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { PlayerStatusService } from '../../services/PlayerStatusService.js';

export class ActionSelectionSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.on(GameEvents.NEXT_ACTOR_DETERMINED, this.onNextActorDetermined.bind(this));
    }

    update(deltaTime) {
        const activePhases = [
            BattlePhase.ACTION_SELECTION,
            BattlePhase.INITIAL_SELECTION 
        ];
        if (!activePhases.includes(this.battleContext.phase)) {
            return;
        }

        if (this.battleContext.turn.currentActorId === null && this.battleContext.turn.actionQueue.length === 0) {
            if (this.battleContext.phase === BattlePhase.ACTION_SELECTION) {
                this.world.emit(GameEvents.ACTION_SELECTION_COMPLETED);
            }
        }
    }

    onNextActorDetermined(detail) {
        const { entityId } = detail;
        this.battleContext.turn.currentActorId = entityId;
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

        if (this.battleContext.turn.currentActorId === entityId) {
            this.battleContext.turn.selectedActions.set(entityId, detail);
            this.battleContext.turn.currentActorId = null;
        }

        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gauge = this.world.getComponent(entityId, Gauge);

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

        PlayerStatusService.transitionTo(this.world, entityId, PlayerStateType.SELECTED_CHARGING);
        
        gauge.value = 0;
        gauge.currentSpeed = 0;
        // 修正: world, entityId を渡す
        gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ 
            world: this.world, 
            entityId, 
            part: selectedPart, 
            factorType: 'charge' 
        });
    }
}