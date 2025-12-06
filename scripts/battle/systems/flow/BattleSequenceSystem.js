/**
 * @file BattleSequenceSystem.js
 * @description アクション実行シーケンスの制御を行うシステム。
 * ロジックはActionSequenceServiceに委譲し、タスクの実行管理に集中する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { BattleContext } from '../../context/index.js';
import { GameState, Action } from '../../components/index.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { ActionSequenceService } from '../../services/ActionSequenceService.js';
import { CooldownService } from '../../services/CooldownService.js';
import { CancellationService } from '../../services/CancellationService.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.service = new ActionSequenceService(world);
        this.taskRunner = new TaskRunner(world);
        
        this.executionQueue = [];
        this.currentActorId = null;
        
        this.on(GameEvents.ACTION_EXECUTION_COMPLETED, this.onActionExecutionCompleted.bind(this));
        this.on(GameEvents.ACTION_EXECUTION_REQUESTED, this.onActionExecutionRequested.bind(this));
        
        this.on(GameEvents.REQUEST_RESET_TO_COOLDOWN, this.onRequestResetToCooldown.bind(this));
        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
    }

    onActionExecutionRequested() {
        if (this.currentActorId !== null || this.executionQueue.length > 0) {
            return;
        }
        
        // 実行キューの構築をサービスに委譲
        this.executionQueue = this.service.getSortedReadyEntities();
        this._processNextInQueue();
    }

    update(deltaTime) {
        this.taskRunner.update(deltaTime);
        this.battleContext.isSequenceRunning = !this.taskRunner.isIdle;

        if (this.taskRunner.isIdle && this.currentActorId !== null) {
            this._finishCurrentActorSequence();
        }
    }
    
    _finishCurrentActorSequence() {
        this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: this.currentActorId });
        this.currentActorId = null;
        this._processNextInQueue();
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

    _startNextActionSequence() {
        const actorId = this.executionQueue.shift();
        if (!this.isValidEntity(actorId)) {
            this._processNextInQueue();
            return;
        }

        this.currentActorId = actorId;

        // シーケンス実行処理をサービスに委譲
        const { tasks, isCancelled } = this.service.executeSequence(actorId);

        if (isCancelled) {
            // キャンセル時は即座に次へ（TaskRunnerには何も積まれていない）
            this.currentActorId = null; // 即時終了扱い
            this._processNextInQueue();
        } else {
            this.taskRunner.addTasks(tasks);
            this.battleContext.isSequenceRunning = true;
        }
    }

    onRequestResetToCooldown(detail) {
        const { entityId, options } = detail;
        CooldownService.resetEntityStateToCooldown(this.world, entityId, options);
    }
    
    onCheckActionCancellation() {
        const actors = this.getEntities(GameState, Action);
        
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) continue;
            
            const check = CancellationService.checkCancellation(this.world, actorId);
            if (check.shouldCancel) {
                CancellationService.executeCancel(this.world, actorId, check.reason);
                CooldownService.resetEntityStateToCooldown(this.world, actorId, { interrupted: true });
            }
        }
    }

    onActionExecutionCompleted() {
        this._reset();
    }
}