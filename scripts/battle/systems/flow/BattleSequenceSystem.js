/**
 * @file BattleSequenceSystem.js
 * @description アクションシーケンスの進行管理。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, BattlePhase, TargetTiming } from '../../common/constants.js';
import { BattleSequenceContext } from '../../components/BattleSequenceContext.js';
import { PhaseContext } from '../../components/PhaseContext.js';
import { TurnContext } from '../../components/TurnContext.js';
import { GameState, Action } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { ActionSequenceService } from '../../services/ActionSequenceService.js';
import { CancellationService } from '../../services/CancellationService.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';
import { BattleResolutionService } from '../../services/BattleResolutionService.js'; 
import { CommandExecutor, createCommand } from '../../common/Command.js';
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
        this.battleSequenceContext = this.world.getSingletonComponent(BattleSequenceContext);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        this.turnContext = this.world.getSingletonComponent(TurnContext);

        this.service = new ActionSequenceService(world);
        this.timelineBuilder = new TimelineBuilder(world);
        this.taskRunner = new TaskRunner(world);
        this.battleResolver = new BattleResolutionService(world); 

        this.executionQueue = [];
        this.internalState = SequenceState.IDLE;
        this.currentActorId = null;

        // イベントは入力トリガーとしてのみ使用
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
        if (this.phaseContext.phase === BattlePhase.GAME_OVER) {
            if (this.internalState !== SequenceState.IDLE) this.abortSequence();
            return;
        }

        // メインステートマシン
        switch (this.internalState) {
            case SequenceState.IDLE:
                if (this.phaseContext.phase === BattlePhase.ACTION_EXECUTION && !this.battleSequenceContext.isSequenceRunning) {
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
        this.battleSequenceContext.isSequenceRunning = true;
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
            // エンティティが無効になっている場合
            return; // 次のループで再試行
        }

        this.currentActorId = actorId;
        this.turnContext.currentActorId = actorId;

        this._startActorSequence(actorId);
        this.internalState = SequenceState.EXECUTING_TASK;
    }

    _startActorSequence(actorId) {
        // --- 0. POST_MOVE ターゲットを解決し、Actionコンポーネントを更新 ---
        this._resolvePostMoveTargetForWorld(this.world, actorId);

        // --- 1. ロジック解決と適用 ---
        // ActionSequenceServiceからタスクとして結果を受け取る
        const resultData = this.service.executeSequence(actorId);

        // Actionの更新情報を処理
        if (resultData.actionUpdates && resultData.actionUpdates.entityId) {
            const { entityId, targetId, targetPartKey } = resultData.actionUpdates;
            const actionComponent = this.world.getComponent(entityId, Action);
            if (actionComponent) {
                actionComponent.targetId = targetId;
                actionComponent.targetPartKey = targetPartKey;
            }
        }

        // 状態変更コマンドを即時実行
        if (resultData.stateUpdates && resultData.stateUpdates.length > 0) {
            const commands = resultData.stateUpdates.map(cmd => createCommand(cmd.type, cmd));
            CommandExecutor.executeCommands(this.world, commands);
        }

        // 副作用イベントを発行
        if (resultData.eventsToEmit) {
            resultData.eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }

        if (resultData.isCancelled) {
            // キャンセルされた場合でも、タスク（メッセージ表示など）があれば実行する
            if (resultData.tasks && resultData.tasks.length > 0) {
                this.taskRunner.setSequence(resultData.tasks, actorId);
            } else {
                // タスクがなければ即座に完了扱いとする
                this.taskRunner.setSequence([], actorId);
            }
            return;
        }

        // --- 2. 正常系の演出シーケンス実行 ---
        this.taskRunner.setSequence(resultData.tasks, actorId);
    }

    _onTaskCompleted() {
        if (this.currentActorId) {
            this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: this.currentActorId });
        }

        this.currentActorId = null;
        this.turnContext.currentActorId = null;
        this.internalState = SequenceState.PROCESSING_QUEUE;
    }

    _finishSequence() {
        this.internalState = SequenceState.IDLE;
        this.battleSequenceContext.isSequenceRunning = false;

        this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
    }

    abortSequence() {
        this.executionQueue = [];
        this.taskRunner.abort();
        this.internalState = SequenceState.IDLE;
        this.currentActorId = null;
        this.battleSequenceContext.isSequenceRunning = false;
    }

    onCheckActionCancellation() {
        const actors = this.getEntities(GameState, Action);
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) continue;

            const check = CancellationService.checkCancellation(this.world, actorId);
            if (check.shouldCancel) {
                CancellationService.executeCancel(this.world, actorId, check.reason);
                const cmd = createCommand('RESET_TO_COOLDOWN', {
                    targetId: actorId,
                    options: { interrupted: true }
                });
                cmd.execute(this.world);
            }
        }
    }
}