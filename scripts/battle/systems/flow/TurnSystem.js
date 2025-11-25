import { System } from '../../../../engine/core/System.js';
import { GameState } from '../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { ErrorHandler } from '../../../../engine/utils/ErrorHandler.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';

export class TurnSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.pendingQueue = [];
        this.world.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.world.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
    }

    onActionQueueRequest(detail) {
        const { entityId } = detail;
        if (!this.pendingQueue.includes(entityId) && !this.battleContext.turn.actionQueue.includes(entityId)) {
            this.pendingQueue.push(entityId);
        }
    }
    
    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        if (!this.battleContext.turn.actionQueue.includes(entityId)) {
            this.battleContext.turn.actionQueue.unshift(entityId);
        }
    }

    update(deltaTime) {
        try {
            if (this.pendingQueue.length > 0) {
                if (this.battleContext.phase === BattlePhase.INITIAL_SELECTION) {
                    this.pendingQueue.sort((a, b) => a - b);
                } else {
                    this.pendingQueue.sort(compareByPropulsion(this.world));
                }
                
                this.battleContext.turn.actionQueue.push(...this.pendingQueue);
                this.pendingQueue = [];
            }

            const activePhases = [
                BattlePhase.ACTION_SELECTION,
                BattlePhase.INITIAL_SELECTION 
            ];
            if (!activePhases.includes(this.battleContext.phase)) {
                return;
            }

            if (this.battleContext.turn.currentActorId === null && this.battleContext.turn.actionQueue.length > 0) {
                const nextActorId = this.battleContext.turn.actionQueue.shift();
                
                const gameState = this.world.getComponent(nextActorId, GameState);
                if (gameState && gameState.state === PlayerStateType.READY_SELECT) {
                    this.world.emit(GameEvents.NEXT_ACTOR_DETERMINED, { entityId: nextActorId });
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'TurnSystem.update' });
        }
    }
}