/**
 * @file BattleSequenceSystem.js
 * @description アクションシーケンスの進行管理。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { TargetTiming } from '../../../common/constants.js';
import { BattleContext } from '../../components/BattleContext.js';
import { GameState, Action } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { ActionSequenceService } from '../../services/ActionSequenceService.js';
import { CancellationService } from '../../services/CancellationService.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';
import { BattleResolutionService } from '../../services/BattleResolutionService.js'; // インポートを追加
import { targetingStrategies } from '../../ai/targetingStrategies.js';

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
        this.timelineBuilder = new TimelineBuilder(world);
        this.taskRunner = new TaskRunner(world);
        this.battleResolver = new BattleResolutionService(world); // 初期化処理を追加
        
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

    _resolvePostMoveTargetForWorld(world, attackerId) {
        const action = world.getComponent(attackerId, Action);
        const parts = world.getComponent(attackerId, Parts);
        if (!action || !parts || !action.partKey) return;
        const attackingPart = parts[action.partKey];
        if (!attackingPart || attackingPart.targetTiming !== TargetTiming.POST_MOVE || action.targetId !== null) return;

        const strategy = targetingStrategies[attackingPart.postMoveTargeting];
        if (strategy) {
            const targetData = strategy({ world, attackerId });
            if (targetData) {
                action.targetId = targetData.targetId;
                action.targetPartKey = targetData.targetPartKey;
            }
        }
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
        // --- 0. POST_MOVE ターゲットを解決し、Actionコンポーネントを更新 ---
        this._resolvePostMoveTargetForWorld(this.world, actorId);

        // --- 1. ロジック解決と適用 ---
        const resultData = this.battleResolver.resolve(actorId);

        // Actionの更新情報を処理 (他の要因でBattleResolutionServiceが返した場合)
        // NOTE: POST_MOVEによるAction更新は既に _resolvePostMoveTargetForWorld で適用済み。
        if (resultData.actionUpdates && resultData.actionUpdates.entityId) {
            const { entityId, targetId, targetPartKey } = resultData.actionUpdates;
            const actionComponent = this.world.getComponent(entityId, Action);
            if (actionComponent) {
                actionComponent.targetId = targetId;
                actionComponent.targetPartKey = targetPartKey;
            }
        }

        // 状態変更コマンドを即時発行
        if (resultData.stateUpdates && resultData.stateUpdates.length > 0) {
            this.world.emit(GameEvents.EXECUTE_COMMANDS, resultData.stateUpdates);
        }

        // 副作用イベントを発行 (ログ出力やUI通知用)
        if (resultData.eventsToEmit) {
            resultData.eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }
        
        if (resultData.isCancelled) {
            this.taskRunner.setSequence([], actorId); 
            return;
        }

        // --- 2. 演出シーケンスの構築と実行 ---
        const visualTasks = this.timelineBuilder.buildVisualSequence(resultData.visualSequence);
        this.taskRunner.setSequence(visualTasks, actorId);
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