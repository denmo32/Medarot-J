/**
 * @file BattleSequenceSystem.js
 * @description アクション実行シーケンスの管理システム。
 * ECS化されたサブシステム(CombatSystem, VisualSequenceSystem)と連携し、
 * コンポーネントの付与・検知によってフローを進める。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, TargetTiming, PlayerStateType } from '../../common/constants.js';
import { 
    BattleSequenceContext, PhaseContext, TurnContext,
    GameState, Action,
    CombatRequest, CombatResult, VisualSequenceRequest, VisualSequence
} from '../../components/index.js';
import { Parts } from '../../../components/index.js'; // 修正: 共通コンポーネントからインポート
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { CancellationService } from '../../services/CancellationService.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';
import { createCommand } from '../../common/Command.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';

// シーケンス処理の内部ステート
const ActorState = {
    IDLE: 'IDLE',
    REQUEST_COMBAT: 'REQUEST_COMBAT',
    WAITING_COMBAT: 'WAITING_COMBAT',
    REQUEST_VISUALS: 'REQUEST_VISUALS',
    WAITING_VISUALS: 'WAITING_VISUALS',
    EXECUTING_TASKS: 'EXECUTING_TASKS',
    COMPLETED: 'COMPLETED'
};

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleSequenceContext = this.world.getSingletonComponent(BattleSequenceContext);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        this.turnContext = this.world.getSingletonComponent(TurnContext);

        this.timelineBuilder = new TimelineBuilder(world);
        this.taskRunner = new TaskRunner(world);

        // 実行キュー
        this.executionQueue = [];
        // アクターごとの処理状態管理 (Map<entityId, ActorState>)
        // 現状は1体ずつ順番に処理するが、将来的な並列化も見据えてMapにしておく
        this.actorStates = new Map();
        
        this.currentActorId = null;

        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
        this.on(GameEvents.GAME_OVER, this.abortSequence.bind(this));
        this.on(GameEvents.GAME_PAUSED, () => { this.taskRunner.isPaused = true; });
        this.on(GameEvents.GAME_RESUMED, () => { this.taskRunner.isPaused = false; });
    }

    update(deltaTime) {
        this.taskRunner.update(deltaTime);

        if (this.phaseContext.phase === BattlePhase.GAME_OVER) {
            if (this.currentActorId) this.abortSequence();
            return;
        }

        // フェーズ監視
        if (this.phaseContext.phase !== BattlePhase.ACTION_EXECUTION) {
            this.currentActorId = null;
            this.battleSequenceContext.isSequenceRunning = false;
            return;
        }

        // シーケンス開始トリガー
        if (!this.battleSequenceContext.isSequenceRunning) {
            this.startExecutionPhase();
        }

        // キュー処理
        if (!this.currentActorId) {
            if (this.executionQueue.length > 0) {
                this._processNextActor();
            } else if (this.battleSequenceContext.isSequenceRunning) {
                // 全員完了
                this.finishExecutionPhase();
            }
        } else {
            // 現在のアクターの状態遷移処理
            this._updateActorSequence(this.currentActorId);
        }
    }

    startExecutionPhase() {
        this.battleSequenceContext.isSequenceRunning = true;
        this.executionQueue = this._getSortedReadyEntities();
    }

    finishExecutionPhase() {
        this.battleSequenceContext.isSequenceRunning = false;
        this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
        
        // 次のフェーズへ
        if (this._isAnyEntityInAction()) {
            this.phaseContext.phase = BattlePhase.ACTION_SELECTION;
        } else {
            this.phaseContext.phase = BattlePhase.TURN_END;
        }
    }

    _processNextActor() {
        const actorId = this.executionQueue.shift();
        if (!this.isValidEntity(actorId)) return;

        this.currentActorId = actorId;
        this.turnContext.currentActorId = actorId;
        this.actorStates.set(actorId, ActorState.IDLE);
    }

    _updateActorSequence(actorId) {
        const state = this.actorStates.get(actorId) || ActorState.IDLE;

        switch (state) {
            case ActorState.IDLE:
                // 実行開始直前の処理 (Targeting, Cancellation Check)
                this._initializeActorSequence(actorId);
                break;

            case ActorState.REQUEST_COMBAT:
                // CombatSystemに計算要求
                this.world.addComponent(actorId, new CombatRequest(actorId));
                this.actorStates.set(actorId, ActorState.WAITING_COMBAT);
                break;

            case ActorState.WAITING_COMBAT:
                // CombatResult待ち
                const combatResult = this.world.getComponent(actorId, CombatResult);
                if (combatResult) {
                    // Result取得 -> Visual生成要求へ
                    this.world.removeComponent(actorId, CombatResult);
                    this._requestVisuals(actorId, combatResult.data);
                }
                break;

            case ActorState.REQUEST_VISUALS:
                // (遷移専用ステート。ここでRequestComponentを貼ると無限ループの恐れがあるため
                //  _requestVisuals関数内でコンポーネントを貼り、直接WAITINGへ移行している)
                break;

            case ActorState.WAITING_VISUALS:
                // VisualSequence待ち
                const visualSequence = this.world.getComponent(actorId, VisualSequence);
                if (visualSequence) {
                    this.world.removeComponent(actorId, VisualSequence);
                    this._startTasks(actorId, visualSequence.tasks, this.lastResultData);
                }
                break;

            case ActorState.EXECUTING_TASKS:
                // タスク完了待ち
                if (this.taskRunner.isIdle) {
                    this.actorStates.set(actorId, ActorState.COMPLETED);
                }
                break;

            case ActorState.COMPLETED:
                this._finalizeActorSequence(actorId);
                break;
        }
    }

    _initializeActorSequence(actorId) {
        // 基本的な状態遷移（アニメーション待機）
        const cmd = createCommand('TRANSITION_STATE', {
            targetId: actorId,
            newState: PlayerStateType.AWAITING_ANIMATION
        });
        cmd.execute(this.world);

        // 1. キャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            // キャンセル時はCombat処理をスキップし、キャンセル演出生成へ
            const context = { isCancelled: true, cancelReason: cancelCheck.reason };
            
            // ACTION_CANCELLED イベント発行
            this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: cancelCheck.reason });
            
            this._requestVisuals(actorId, context);
            return;
        }

        // 2. POST_MOVE ターゲット解決
        this._resolvePostMoveTargetForWorld(this.world, actorId);

        // 3. CombatRequest発行へ
        this.actorStates.set(actorId, ActorState.REQUEST_COMBAT);
    }

    _requestVisuals(actorId, context) {
        // CombatSystemで生成された副作用イベントがあればここで発行
        // (VisualSequenceSystemは純粋にタスク生成のみを行うため)
        if (context.eventsToEmit) {
            context.eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }
        
        // 状態変更コマンドがあればタスクに組み込むために保持しておく
        // (VisualSequenceSystemにはコンテキストとして渡す)
        this.lastResultData = context;

        // VisualSequenceSystemに要求
        this.world.addComponent(actorId, new VisualSequenceRequest(context));
        this.actorStates.set(actorId, ActorState.WAITING_VISUALS);
    }

    _startTasks(actorId, visualTasks, resultData) {
        // 状態変更コマンドがある場合、演出シーケンス内の適切な位置に追加
        const tasks = [...visualTasks];
        
        if (resultData && resultData.stateUpdates && resultData.stateUpdates.length > 0) {
            const commandTask = {
                type: 'EVENT',
                eventName: GameEvents.EXECUTE_COMMANDS,
                detail: resultData.stateUpdates
            };

            const refreshIndex = tasks.findIndex(v => v.type === 'EVENT' && v.eventName === GameEvents.REFRESH_UI);
            if (refreshIndex !== -1) {
                tasks.splice(refreshIndex, 0, commandTask);
            } else {
                tasks.push(commandTask);
            }
        }

        const builtTasks = this.timelineBuilder.buildVisualSequence(tasks);
        
        if (builtTasks && builtTasks.length > 0) {
            this.taskRunner.setSequence(builtTasks, actorId);
        } else {
            this.taskRunner.setSequence([], actorId);
        }
        
        this.actorStates.set(actorId, ActorState.EXECUTING_TASKS);
    }

    _finalizeActorSequence(actorId) {
        this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: actorId });
        this.actorStates.delete(actorId);
        this.currentActorId = null;
        this.turnContext.currentActorId = null;
        this.lastResultData = null;
    }

    // --- Helpers ---

    _getSortedReadyEntities() {
        const entities = this.world.getEntitiesWith(GameState);
        const readyList = entities.filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        readyList.sort((a, b) => {
            const partsA = this.world.getComponent(a, Parts);
            const partsB = this.world.getComponent(b, Parts);
            if (!partsA || !partsB) return 0;
            const propA = partsA.legs?.propulsion || 0;
            const propB = partsB.legs?.propulsion || 0;
            return propB - propA;
        });

        return readyList;
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

    _isAnyEntityInAction() {
        const entities = this.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.CHARGING || 
                   state.state === PlayerStateType.READY_SELECT ||
                   state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }

    abortSequence() {
        this.executionQueue = [];
        this.actorStates.clear();
        this.taskRunner.abort();
        this.currentActorId = null;
        this.battleSequenceContext.isSequenceRunning = false;
        this.lastResultData = null;
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