import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../context/index.js';
import { BattlePhase } from '../../../config/constants.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo } from '../../components/index.js';

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
        const { entityId } = detail;

        if (this.battleContext.turn.currentActorId === entityId) {
            this.battleContext.turn.selectedActions.set(entityId, detail);
            this.battleContext.turn.currentActorId = null;
        }
    }
}