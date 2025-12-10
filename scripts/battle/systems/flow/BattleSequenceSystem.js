/**
 * @file BattleSequenceSystem.js
 * @description アクションシーケンスの進行管理。
 * Phase 3: ステートマシン強化とイベント依存の削減
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { BattleContext } from '../../components/BattleContext.js';
import { GameState, Action } from '../../components/index.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { ActionSequenceService } from '../../services/ActionSequenceService.js';
import { CancellationService } from '../../services/CancellationService.js';

// 内部ステート定義
const SequenceState = {
    IDLE: 'IDLE',
    PREPARING: 'PREPARING',
    PROCESSING_QUEUE: 'PROCESSING_QUEUE',
    EXECUTING_TASK: 'EXECUTING_TASK',
    FINISHING: 'FINISHING'
};

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.service = new ActionSequenceService(world);
        this.taskRunner = new TaskRunner(world);
        
        this.executionQueue = [];
        this.internalState = SequenceState.IDLE;
        this.currentActorId = null;

        // イベントは入力トリガーとしてのみ使用
        this.on(GameEvents.REQUEST_RESET_TO_COOLDOWN, this.onRequestResetToCooldown.bind(this));
        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
        this.on(GameEvents.GAME_OVER, this.abortSequence.bind(this));
        
        this.on(GameEvents.GAME_PAUSED, () => { this.taskRunner.isPaused = true; });
        this.on(GameEvents.GAME_RESUMED, () => { this.taskRunner.isPaused = false; });
    }

    update(deltaTime) {
        // TaskRunnerは常に更新
        this.taskRunner.update(deltaTime);

        // ゲームオーバー時は処理しない
        if (this.battleContext.phase === BattlePhase.GAME_OVER) {
            if (this.internalState !== SequenceState.IDLE) this.abortSequence();
            return;
        }

        // メインステートマシン
        switch (this.internalState) {
            case SequenceState.IDLE:
                // BattleContextのフェーズを監視して起動
                if (this.battleContext.phase === BattlePhase.ACTION_EXECUTION && !this.battleContext.isSequenceRunning) {
                    this._startExecutionPhase();
                }
                break;

            case SequenceState.PREPARING:
                this._prepareQueue();
                break;

            case SequenceState.PROCESSING_QUEUE:
                this._processQueueNext();
                break;
                
            case SequenceState.EXECUTING_TASK:
                if (this.taskRunner.isIdle) {
                    this._onTaskCompleted();
                }
                break;
                
            case SequenceState.FINISHING:
                this._finishSequence();
                break;
        }
    }

    _startExecutionPhase() {
        this.internalState = SequenceState.PREPARING;
        this.battleContext.isSequenceRunning = true;
    }

    _prepareQueue() {
        this.executionQueue = this.service.getSortedReadyEntities();
        
        if (this.executionQueue.length === 0) {
            this.internalState = SequenceState.FINISHING;
        } else {
            this.internalState = SequenceState.PROCESSING_QUEUE;
        }
    }

    _processQueueNext() {
        if (this.executionQueue.length === 0) {
            this.internalState = SequenceState.FINISHING;
            return;
        }

        const actorId = this.executionQueue.shift();
        if (!this.isValidEntity(actorId)) {
            return; // 次のループで再試行
        }

        this.currentActorId = actorId;
        this.battleContext.turn.currentActorId = actorId;
        
        this._startActorSequence(actorId);
        this.internalState = SequenceState.EXECUTING_TASK;
    }

    _startActorSequence(actorId) {
        const { tasks, isCancelled, eventsToEmit, stateUpdates } = this.service.executeSequence(actorId);

        // 状態変更コマンドを即時発行
        if (stateUpdates && stateUpdates.length > 0) {
            this.world.emit(GameEvents.EXECUTE_COMMANDS, stateUpdates);
        }
        
        // イベント発行 (ログ出力やUI通知用)
        if (eventsToEmit) {
            eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }

        if (isCancelled) {
            this.taskRunner.setSequence([], actorId); 
            // キャンセルされた場合もタスク完了扱いとして即座にアイドルに戻る
            return;
        }

        if (tasks.length > 0) {
            this.taskRunner.setSequence(tasks, actorId);
        } else {
             this.taskRunner.setSequence([], actorId);
        }
    }

    _onTaskCompleted() {
        if (this.currentActorId) {
            this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: this.currentActorId });
        }
        
        this.currentActorId = null;
        this.battleContext.turn.currentActorId = null;
        this.internalState = SequenceState.PROCESSING_QUEUE;
    }

    _finishSequence() {
        this.internalState = SequenceState.IDLE;
        this.battleContext.isSequenceRunning = false;
        
        // 完了通知イベント
        this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
    }

    abortSequence() {
        this.executionQueue = [];
        this.taskRunner.abort();
        this.internalState = SequenceState.IDLE;
        this.currentActorId = null;
        this.battleContext.isSequenceRunning = false;
    }

    onRequestResetToCooldown(detail) {
        const { entityId, options } = detail;
        this.world.emit(GameEvents.EXECUTE_COMMANDS, [{
            type: 'RESET_TO_COOLDOWN',
            targetId: entityId,
            options: options
        }]);
    }
    
    onCheckActionCancellation() {
        // システム内で完結させるべきだが、イベント経由での呼び出しも維持
        const actors = this.getEntities(GameState, Action);
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) continue;
            
            const check = CancellationService.checkCancellation(this.world, actorId);
            if (check.shouldCancel) {
                CancellationService.executeCancel(this.world, actorId, check.reason);
                this.world.emit(GameEvents.EXECUTE_COMMANDS, [{
                    type: 'RESET_TO_COOLDOWN',
                    targetId: actorId,
                    options: { interrupted: true }
                }]);
            }
        }
    }
}