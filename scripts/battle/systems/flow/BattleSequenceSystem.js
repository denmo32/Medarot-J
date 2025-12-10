/**
 * @file BattleSequenceSystem.js
 * @description アクションシーケンスの進行管理。
 * TaskRunnerのステートマシン化に伴い、updateループ内での監視ロジックへ変更。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { BattleContext } from '../../components/BattleContext.js';
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
        
        // ステート管理用
        this.state = 'IDLE'; // IDLE, PROCESSING_QUEUE, EXECUTING_TASK
        this.currentActorId = null;

        this.on(GameEvents.ACTION_EXECUTION_REQUESTED, this.onActionExecutionRequested.bind(this));
        
        this.on(GameEvents.REQUEST_RESET_TO_COOLDOWN, this.onRequestResetToCooldown.bind(this));
        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
        this.on(GameEvents.GAME_OVER, this.abortSequence.bind(this));
        
        // ポーズ対応
        this.on(GameEvents.GAME_PAUSED, () => { this.taskRunner.isPaused = true; });
        this.on(GameEvents.GAME_RESUMED, () => { this.taskRunner.isPaused = false; });
    }

    onActionExecutionRequested() {
        if (this.state !== 'IDLE') return;

        // 実行対象の収集とソート
        this.executionQueue = this.service.getSortedReadyEntities();
        
        if (this.executionQueue.length === 0) {
            this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
            return;
        }

        this.state = 'PROCESSING_QUEUE';
        this.battleContext.isSequenceRunning = true;
    }

    update(deltaTime) {
        // 1. TaskRunnerの更新
        this.taskRunner.update(deltaTime);

        // 2. シーケンス進行管理
        if (this.state === 'IDLE') return;

        if (!this.isValidState()) {
            this.abortSequence();
            return;
        }

        switch (this.state) {
            case 'PROCESSING_QUEUE':
                this._processQueueNext();
                break;
                
            case 'EXECUTING_TASK':
                if (this.taskRunner.isIdle) {
                    // アクターのタスク完了
                    this.battleContext.turn.currentActorId = null;
                    this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: this.currentActorId });
                    this.currentActorId = null;
                    this.state = 'PROCESSING_QUEUE';
                }
                break;
        }
    }

    _processQueueNext() {
        if (this.executionQueue.length === 0) {
            this._finishSequence();
            return;
        }

        const actorId = this.executionQueue.shift();

        // 無効なエンティティはスキップ
        if (!this.isValidEntity(actorId)) {
            // 次のフレームで再試行
            return;
        }

        this.currentActorId = actorId;
        this.battleContext.turn.currentActorId = actorId;
        
        this._startActorSequence(actorId);
        this.state = 'EXECUTING_TASK';
    }

    _startActorSequence(actorId) {
        const { tasks, isCancelled, eventsToEmit } = this.service.executeSequence(actorId);

        // 副作用(イベント発行)を一括実行
        if (eventsToEmit) {
            eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }

        if (isCancelled) {
            // タスクなしで完了扱いにする
            this.taskRunner.setSequence([], actorId); 
            // 次フレームでisIdle検知されて完了処理が走る
            return;
        }

        if (tasks.length > 0) {
            this.taskRunner.setSequence(tasks, actorId);
        } else {
             this.taskRunner.setSequence([], actorId);
        }
    }

    _finishSequence() {
        this.state = 'IDLE';
        this.battleContext.isSequenceRunning = false;
        this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
    }

    isValidState() {
        return this.battleContext.phase !== 'GAME_OVER';
    }

    abortSequence() {
        this.executionQueue = [];
        this.taskRunner.abort();
        this.state = 'IDLE';
        this.currentActorId = null;
        this.battleContext.isSequenceRunning = false;
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
}