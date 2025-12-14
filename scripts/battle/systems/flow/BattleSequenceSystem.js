/**
 * @file BattleSequenceSystem.js
 * @description アクション実行シーケンスの管理システム。
 * 内部キュー(executionQueue)とコンテキスト(BattleSequenceContext)を廃止し、
 * SequencePendingコンポーネントによる動的なエンティティ制御へ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, TargetTiming, PlayerStateType } from '../../common/constants.js';
import { 
    PhaseContext, TurnContext,
    GameState, Action,
    CombatRequest, CombatResult, VisualSequenceRequest, VisualSequenceResult, VisualSequence,
    BattleSequenceState, SequenceState, SequencePending
} from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { CancellationService } from '../../services/CancellationService.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';
import { createCommand } from '../../common/Command.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        this.turnContext = this.world.getSingletonComponent(TurnContext);

        this.timelineBuilder = new TimelineBuilder(world);
        
        // 内部状態(currentActorId)は保持するが、これは「現在処理中の主体」を特定するためだけのキャッシュとして扱う
        this.currentActorId = null;

        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
        this.on(GameEvents.GAME_OVER, this.abortSequence.bind(this));
    }

    update(deltaTime) {
        if (this.phaseContext.phase === BattlePhase.GAME_OVER) {
            if (this.currentActorId) this.abortSequence();
            return;
        }

        if (this.phaseContext.phase !== BattlePhase.ACTION_EXECUTION) {
            this.currentActorId = null;
            return;
        }

        // 1. フェーズ開始時の初期化チェック
        // 実行待ち(Pending)も実行中(State持ち)もいない場合、フェーズ開始処理を行うべきか判断する
        // ただし、updateループ内で判断するには「未処理のREADY_EXECUTEがいるか」を見る必要がある
        const pendingEntities = this.getEntities(SequencePending);
        const activeEntities = this.getEntities(BattleSequenceState);

        if (pendingEntities.length === 0 && activeEntities.length === 0) {
            // まだSequencePendingが付与されていないREADY_EXECUTEを探す
            if (this._hasUnmarkedReadyEntities()) {
                this.startExecutionPhase();
            } else {
                // 誰も処理対象がいないならフェーズ終了
                // (前フレームで処理が完了してここに来た場合を含む)
                // ※ startExecutionPhase直後はpendingEntitiesが存在するためここには来ない
                this.finishExecutionPhase();
                return;
            }
        }

        // 2. 実行中のエンティティがいればその更新処理
        if (this.currentActorId) {
            // currentActorIdが有効か、コンポーネントを持っているか確認
            const sequenceState = this.world.getComponent(this.currentActorId, BattleSequenceState);
            if (sequenceState) {
                this._updateActorSequence(this.currentActorId, sequenceState);
            } else {
                // コンポーネントが外れている場合は処理終了とみなす
                this.currentActorId = null;
            }
        } 
        // 3. 実行中のエンティティがいない場合、次のエンティティを選出
        else {
            this._processNextActor();
        }
    }

    _hasUnmarkedReadyEntities() {
        // GameStateがREADY_EXECUTEかつ、SequencePendingもBattleSequenceStateも持っていないエンティティがあるか
        const entities = this.world.getEntitiesWith(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE &&
                   !this.world.getComponent(id, SequencePending) &&
                   !this.world.getComponent(id, BattleSequenceState);
        });
    }

    startExecutionPhase() {
        const entities = this.world.getEntitiesWith(GameState);
        for (const id of entities) {
            const state = this.world.getComponent(id, GameState);
            if (state.state === PlayerStateType.READY_EXECUTE) {
                // 実行待ちタグを付与
                this.world.addComponent(id, new SequencePending());
            }
        }
    }

    finishExecutionPhase() {
        this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
        
        if (this._isAnyEntityInAction()) {
            this.phaseContext.phase = BattlePhase.ACTION_SELECTION;
        } else {
            this.phaseContext.phase = BattlePhase.TURN_END;
        }
    }

    _processNextActor() {
        // SequencePendingを持つエンティティの中から、優先度が最も高いものを取得
        const nextActorId = this._getNextPendingEntity();
        if (nextActorId === null) return;

        // 状態遷移: Pending -> Active
        this.world.removeComponent(nextActorId, SequencePending);
        this.world.addComponent(nextActorId, new BattleSequenceState());

        this.currentActorId = nextActorId;
        this.turnContext.currentActorId = nextActorId;
    }

    _getNextPendingEntity() {
        const pendingEntities = this.getEntities(SequencePending);
        if (pendingEntities.length === 0) return null;

        // ソートして先頭を返す
        // ※ 毎フレームソートはコストがかかるが、戦闘参加人数は少数(最大6)なので許容範囲
        pendingEntities.sort((a, b) => {
            const partsA = this.world.getComponent(a, Parts);
            const partsB = this.world.getComponent(b, Parts);
            if (!partsA || !partsB) return 0;
            const propA = partsA.legs?.propulsion || 0;
            const propB = partsB.legs?.propulsion || 0;
            return propB - propA; // 推進力が高い順
        });

        return pendingEntities[0];
    }

    _updateActorSequence(actorId, sequenceState) {
        switch (sequenceState.currentState) {
            case SequenceState.IDLE:
                this._initializeActorSequence(actorId, sequenceState);
                break;

            case SequenceState.REQUEST_COMBAT:
                this.world.addComponent(actorId, new CombatRequest(actorId));
                sequenceState.currentState = SequenceState.WAITING_COMBAT;
                break;

            case SequenceState.WAITING_COMBAT:
                const combatResult = this.world.getComponent(actorId, CombatResult);
                if (combatResult) {
                    this.world.removeComponent(actorId, CombatResult);
                    this._requestVisuals(actorId, sequenceState, combatResult.data);
                }
                break;

            case SequenceState.REQUEST_VISUALS:
                break;

            case SequenceState.WAITING_VISUALS:
                const result = this.world.getComponent(actorId, VisualSequenceResult);
                if (result) {
                    this.world.removeComponent(actorId, VisualSequenceResult);
                    this._startTasks(actorId, sequenceState, result.sequence);
                }
                break;

            case SequenceState.EXECUTING_TASKS:
                if (!this.world.getComponent(actorId, VisualSequence)) {
                    sequenceState.currentState = SequenceState.COMPLETED;
                }
                break;

            case SequenceState.COMPLETED:
                this._finalizeActorSequence(actorId);
                break;
        }
    }

    _initializeActorSequence(actorId, sequenceState) {
        const cmd = createCommand('TRANSITION_STATE', {
            targetId: actorId,
            newState: PlayerStateType.AWAITING_ANIMATION
        });
        cmd.execute(this.world);

        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            const context = { isCancelled: true, cancelReason: cancelCheck.reason };
            this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: cancelCheck.reason });
            this._requestVisuals(actorId, sequenceState, context);
            return;
        }

        this._resolvePostMoveTargetForWorld(this.world, actorId);
        sequenceState.currentState = SequenceState.REQUEST_COMBAT;
    }

    _requestVisuals(actorId, sequenceState, context) {
        if (context.eventsToEmit) {
            context.eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }
        
        sequenceState.contextData = context;

        this.world.addComponent(actorId, new VisualSequenceRequest(context));
        sequenceState.currentState = SequenceState.WAITING_VISUALS;
    }

    _startTasks(actorId, sequenceState, visualTasks) {
        const tasks = [...visualTasks];
        const resultData = sequenceState.contextData;
        
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
        this.world.addComponent(actorId, new VisualSequence(builtTasks));
        sequenceState.currentState = SequenceState.EXECUTING_TASKS;
    }

    _finalizeActorSequence(actorId) {
        this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: actorId });
        
        // 状態コンポーネントを削除して完了とする
        this.world.removeComponent(actorId, BattleSequenceState);
        
        this.currentActorId = null;
        this.turnContext.currentActorId = null;
    }

    // --- Helpers ---

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
        // 管理中の全エンティティから状態系コンポーネントを削除
        const pendingEntities = this.getEntities(SequencePending);
        for (const entityId of pendingEntities) {
            this.world.removeComponent(entityId, SequencePending);
        }

        const activeEntities = this.getEntities(BattleSequenceState);
        for (const entityId of activeEntities) {
            this.world.removeComponent(entityId, BattleSequenceState);
        }
        
        // 念のためVisualSequenceも削除
        if (this.currentActorId) {
            this.world.removeComponent(this.currentActorId, VisualSequence);
        }
        
        this.currentActorId = null;
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