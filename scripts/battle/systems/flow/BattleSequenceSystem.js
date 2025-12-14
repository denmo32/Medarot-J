/**
 * @file BattleSequenceSystem.js
 * @description アクション実行シーケンスの管理システム。
 * TaskRunnerを完全に削除し、TaskSystem用のコンポーネント(VisualSequence)を生成して付与する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, TargetTiming, PlayerStateType } from '../../common/constants.js';
import { 
    BattleSequenceContext, PhaseContext, TurnContext,
    GameState, Action,
    CombatRequest, CombatResult, VisualSequenceRequest, VisualSequenceResult, VisualSequence
} from '../../components/index.js';
import { Parts } from '../../../components/index.js';
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
        // TaskRunner は削除

        this.executionQueue = [];
        this.actorStates = new Map();
        this.currentActorId = null;
        this.lastResultData = null; // lastResultDataの初期化

        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
        this.on(GameEvents.GAME_OVER, this.abortSequence.bind(this));
    }

    update(deltaTime) {
        // TaskRunner.update(deltaTime) は不要（TaskSystemが処理する）

        if (this.phaseContext.phase === BattlePhase.GAME_OVER) {
            if (this.currentActorId) this.abortSequence();
            return;
        }

        if (this.phaseContext.phase !== BattlePhase.ACTION_EXECUTION) {
            this.currentActorId = null;
            this.battleSequenceContext.isSequenceRunning = false;
            return;
        }

        if (!this.battleSequenceContext.isSequenceRunning) {
            this.startExecutionPhase();
        }

        if (!this.currentActorId) {
            if (this.executionQueue.length > 0) {
                this._processNextActor();
            } else if (this.battleSequenceContext.isSequenceRunning) {
                this.finishExecutionPhase();
            }
        } else {
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
                this._initializeActorSequence(actorId);
                break;

            case ActorState.REQUEST_COMBAT:
                this.world.addComponent(actorId, new CombatRequest(actorId));
                this.actorStates.set(actorId, ActorState.WAITING_COMBAT);
                break;

            case ActorState.WAITING_COMBAT:
                const combatResult = this.world.getComponent(actorId, CombatResult);
                if (combatResult) {
                    this.world.removeComponent(actorId, CombatResult);
                    this._requestVisuals(actorId, combatResult.data);
                }
                break;

            case ActorState.REQUEST_VISUALS:
                break;

            case ActorState.WAITING_VISUALS:
                // VisualSequenceResult (未変換データ) を待つ
                const result = this.world.getComponent(actorId, VisualSequenceResult);
                if (result) {
                    this.world.removeComponent(actorId, VisualSequenceResult);
                    // 変換して VisualSequence (実行用データ) を付与
                    this._startTasks(actorId, result.sequence, this.lastResultData);
                }
                break;

            case ActorState.EXECUTING_TASKS:
                // VisualSequenceコンポーネントがなくなれば完了とみなす
                // (TaskSystemはタスクが空になるとVisualSequenceを削除する)
                if (!this.world.getComponent(actorId, VisualSequence)) {
                    this.actorStates.set(actorId, ActorState.COMPLETED);
                }
                break;

            case ActorState.COMPLETED:
                this._finalizeActorSequence(actorId);
                break;
        }
    }

    _initializeActorSequence(actorId) {
        const cmd = createCommand('TRANSITION_STATE', {
            targetId: actorId,
            newState: PlayerStateType.AWAITING_ANIMATION
        });
        cmd.execute(this.world);

        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            const context = { isCancelled: true, cancelReason: cancelCheck.reason };
            this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: cancelCheck.reason });
            this._requestVisuals(actorId, context);
            return;
        }

        this._resolvePostMoveTargetForWorld(this.world, actorId);
        this.actorStates.set(actorId, ActorState.REQUEST_COMBAT);
    }

    _requestVisuals(actorId, context) {
        if (context.eventsToEmit) {
            context.eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }
        
        // 状態変更用データを保持
        this.lastResultData = context;

        this.world.addComponent(actorId, new VisualSequenceRequest(context));
        this.actorStates.set(actorId, ActorState.WAITING_VISUALS);
    }

    _startTasks(actorId, visualTasks, resultData) {
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

        // ここで変換を行う
        const builtTasks = this.timelineBuilder.buildVisualSequence(tasks);
        
        // 実行用コンポーネントを付与
        this.world.addComponent(actorId, new VisualSequence(builtTasks));
        
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
        // TaskRunnerがないので、現在のアクターのVisualSequenceコンポーネントを削除して停止させる
        if (this.currentActorId) {
            this.world.removeComponent(this.currentActorId, VisualSequence);
        }
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