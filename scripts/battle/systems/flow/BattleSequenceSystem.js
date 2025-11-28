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
    }

    update(deltaTime) {
        this.taskRunner.update(deltaTime);

        // コンテキストのフラグを更新（GaugeSystemなどが参照する）
        this.battleContext.isSequenceRunning = !this.taskRunner.isIdle;

        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            if (this.executionQueue.length > 0 || this.currentActorId !== null) {
                this._reset();
            }
            return;
        }

        if (!this.taskRunner.isIdle) {
            return;
        }

        if (this.currentActorId === null) {
            if (this.executionQueue.length === 0) {
                this._populateExecutionQueueFromReady();
                
                if (this.executionQueue.length === 0) {
                    this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
                    return;
                }
            }
            
            this._startNextActionSequence();
        } else {
            this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: this.currentActorId });
            this.currentActorId = null;
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
        if (!actorId) return;

        this.currentActorId = actorId;
        const actionComp = this.world.getComponent(actorId, Action);

        const gameState = this.world.getComponent(actorId, GameState);
        if (gameState) gameState.state = PlayerStateType.AWAITING_ANIMATION;

        this._determinePostMoveTarget(actorId, actionComp);

        const resultData = this.battleResolver.resolve(actorId);
        const tasks = this.timelineBuilder.buildAttackSequence(resultData);
        this.taskRunner.addTasks(tasks);
        
        // 即座にフラグを立てる
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