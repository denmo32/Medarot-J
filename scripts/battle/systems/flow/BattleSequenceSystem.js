/**
 * @file BattleSequenceSystem.js
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, PlayerStateType } from '../../common/constants.js';
import { BattleContext } from '../../context/index.js';
import { GameState, Action } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';
import { BattleResolver } from '../../logic/BattleResolver.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';
import { TargetTiming } from '../../../common/constants.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.battleResolver = new BattleResolver(world);
        this.timelineBuilder = new TimelineBuilder(world);
        this.taskRunner = new TaskRunner(world);
        
        this.executionQueue = [];
        this.currentActorId = null;
        
        this.on(GameEvents.ACTION_EXECUTION_COMPLETED, this.onActionExecutionCompleted.bind(this));
        this.on(GameEvents.ACTION_EXECUTION_REQUESTED, this.onActionExecutionRequested.bind(this));
    }

    onActionExecutionRequested() {
        if (this.currentActorId !== null || this.executionQueue.length > 0) {
            return;
        }
        
        this._populateExecutionQueueFromReady();
        this._processNextInQueue();
    }

    update(deltaTime) {
        this.taskRunner.update(deltaTime);
        this.battleContext.isSequenceRunning = !this.taskRunner.isIdle;

        if (this.taskRunner.isIdle && this.currentActorId !== null) {
            this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: this.currentActorId });
            this.currentActorId = null;
            this._processNextInQueue();
        }
    }
    
    _processNextInQueue() {
        if (this.executionQueue.length > 0) {
            this._startNextActionSequence();
        } else {
            if (!this.battleContext.isSequenceRunning) {
                this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
            }
        }
    }

    _reset() {
        this.executionQueue = [];
        this.currentActorId = null;
        this.taskRunner.clear();
        this.battleContext.isSequenceRunning = false;
    }

    _populateExecutionQueueFromReady() {
        const readyEntities = this.getEntities(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        readyEntities.sort(compareByPropulsion(this.world));
        this.executionQueue = readyEntities;
    }

    _startNextActionSequence() {
        const actorId = this.executionQueue.shift();
        if (!this.isValidEntity(actorId)) {
            this._processNextInQueue();
            return;
        }

        this.currentActorId = actorId;
        const actionComp = this.world.getComponent(actorId, Action);

        this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId: actorId, newState: PlayerStateType.AWAITING_ANIMATION });

        this._determinePostMoveTarget(actorId, actionComp);

        const resultData = this.battleResolver.resolve(actorId);
        const tasks = this.timelineBuilder.buildAttackSequence(resultData);
        this.taskRunner.addTasks(tasks);
        
        this.battleContext.isSequenceRunning = true;
    }

    _determinePostMoveTarget(executorId, action) {
        const parts = this.world.getComponent(executorId, Parts);
        if (!parts || !action.partKey) return;
        
        const selectedPart = parts[action.partKey];

        if (selectedPart && selectedPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
            const strategy = targetingStrategies[selectedPart.postMoveTargeting];
            if (strategy) {
                const targetData = strategy({ world: this.world, attackerId: executorId });
                if (targetData) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                }
            }
        }
    }

    onActionExecutionCompleted() {
        this._reset();
    }
}