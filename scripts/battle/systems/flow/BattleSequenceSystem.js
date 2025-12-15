/**
 * @file BattleSequenceSystem.js
 * @description アクション実行シーケンスの管理システム。
 * キャンセル処理などをデータ駆動（コンポーネント生成）で行うよう改修。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js'; // 参照用に定数のみ使用
import { BattlePhase, TargetTiming, PlayerStateType, ModalType } from '../../common/constants.js';
import { 
    PhaseState, TurnContext,
    GameState, Action,
    CombatRequest, CombatResult, VisualSequenceRequest, VisualSequenceResult, VisualSequence,
    BattleSequenceState, SequenceState, SequencePending
} from '../../components/index.js';
import { 
    TransitionStateRequest, ResetToCooldownRequest,
    SetPlayerBrokenRequest, UpdateComponentRequest, CustomUpdateComponentRequest,
    TransitionToCooldownRequest
} from '../../components/CommandRequests.js';
import { 
    CheckActionCancellationRequest, 
    ActionCancelledEvent,
    ModalRequest 
} from '../../components/Requests.js';
import { Parts } from '../../../components/index.js';
import { CancellationService } from '../../services/CancellationService.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
        this.turnContext = this.world.getSingletonComponent(TurnContext);

        this.timelineBuilder = new TimelineBuilder(world);
        this.currentActorId = null;
    }

    update(deltaTime) {
        if (this.phaseState.phase === BattlePhase.GAME_OVER) {
            if (this.currentActorId) this.abortSequence();
            return;
        }
        
        // 1. キャンセルチェックリクエストの処理 (前のシーケンス等から要求された場合)
        this._processCancellationRequests();

        // 2. 実行フェーズの監視
        if (this.phaseState.phase !== BattlePhase.ACTION_EXECUTION) {
            this.currentActorId = null;
            return;
        }

        // 3. シーケンス進行管理
        
        const pendingEntities = this.getEntities(SequencePending);
        const activeEntities = this.getEntities(BattleSequenceState);

        // 何も処理するものがなく、シーケンスも動いていない場合
        if (pendingEntities.length === 0 && activeEntities.length === 0) {
            // まだ実行待機状態のエンティティがいるか確認し、いればPendingタグを付与
            if (this._hasUnmarkedReadyEntities()) {
                this.startExecutionPhase();
            } else {
                // 全て完了 -> TurnSystemがこれを検知してフェーズ遷移させる
                this.currentActorId = null;
                this.turnContext.currentActorId = null;
                return;
            }
        }

        if (this.currentActorId) {
            const sequenceState = this.world.getComponent(this.currentActorId, BattleSequenceState);
            if (sequenceState) {
                this._updateActorSequence(this.currentActorId, sequenceState);
            } else {
                // シーケンス状態コンポーネントが外れている = 完了
                this.currentActorId = null;
            }
        } 
        else {
            this._processNextActor();
        }
    }

    _processCancellationRequests() {
        const requests = this.getEntities(CheckActionCancellationRequest);
        if (requests.length > 0) {
            this._checkActionCancellation();
            for (const id of requests) this.world.destroyEntity(id);
        }
    }

    _checkActionCancellation() {
        const actors = this.getEntities(GameState, Action);
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) continue;

            // 純粋なロジックサービスによる判定
            const check = CancellationService.checkCancellation(this.world, actorId);
            
            if (check.shouldCancel) {
                // 1. ログ用イベントコンポーネント生成
                const evt = this.world.createEntity();
                this.world.addComponent(evt, new ActionCancelledEvent(actorId, check.reason));
                
                // 2. ユーザーへの通知 (メッセージ表示リクエスト)
                const message = CancellationService.getCancelMessage(this.world, actorId, check.reason);
                if (message) {
                    const msgReq = this.world.createEntity();
                    this.world.addComponent(msgReq, new ModalRequest(
                        ModalType.MESSAGE,
                        { message: message },
                        {
                            messageSequence: [{ text: message }],
                            priority: 'high'
                        }
                    ));
                }

                // 3. 状態リセットリクエスト
                const resetReq = this.world.createEntity();
                this.world.addComponent(resetReq, new ResetToCooldownRequest(
                    actorId,
                    { interrupted: true }
                ));
            }
        }
    }

    _hasUnmarkedReadyEntities() {
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
                if (!this.world.getComponent(id, SequencePending)) {
                    this.world.addComponent(id, new SequencePending());
                }
            }
        }
    }

    _processNextActor() {
        const nextActorId = this._getNextPendingEntity();
        if (nextActorId === null) return;

        // Pendingタグを外し、SequenceStateを付与して開始
        this.world.removeComponent(nextActorId, SequencePending);
        this.world.addComponent(nextActorId, new BattleSequenceState());

        this.currentActorId = nextActorId;
        this.turnContext.currentActorId = nextActorId;
    }

    _getNextPendingEntity() {
        const pendingEntities = this.getEntities(SequencePending);
        if (pendingEntities.length === 0) return null;

        // 推進力順にソート（同時の場合の優先順位）
        pendingEntities.sort((a, b) => {
            const partsA = this.world.getComponent(a, Parts);
            const partsB = this.world.getComponent(b, Parts);
            if (!partsA || !partsB) return 0;
            const propA = partsA.legs?.propulsion || 0;
            const propB = partsB.legs?.propulsion || 0;
            return propB - propA; 
        });

        return pendingEntities[0];
    }

    _updateActorSequence(actorId, sequenceState) {
        switch (sequenceState.currentState) {
            case SequenceState.IDLE:
                this._initializeActorSequence(actorId, sequenceState);
                break;

            case SequenceState.REQUEST_COMBAT:
                // CombatSystem へリクエスト発行
                this.world.addComponent(actorId, new CombatRequest(actorId));
                sequenceState.currentState = SequenceState.WAITING_COMBAT;
                break;

            case SequenceState.WAITING_COMBAT:
                const combatResult = this.world.getComponent(actorId, CombatResult);
                if (combatResult) {
                    // 結果を受け取り、リクエストを消費
                    this.world.removeComponent(actorId, CombatResult);
                    this._requestVisuals(actorId, sequenceState, combatResult.data);
                }
                break;

            case SequenceState.REQUEST_VISUALS:
                // 処理待ち（現在は即座にWAITING_VISUALSへ遷移するためここは通過しない）
                break;

            case SequenceState.WAITING_VISUALS:
                const result = this.world.getComponent(actorId, VisualSequenceResult);
                if (result) {
                    this.world.removeComponent(actorId, VisualSequenceResult);
                    this._startTasks(actorId, sequenceState, result.sequence);
                }
                break;

            case SequenceState.EXECUTING_TASKS:
                // TaskSystemがVisualSequenceコンポーネントを削除するのを待つ
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
        const reqEntity = this.world.createEntity();
        this.world.addComponent(reqEntity, new TransitionStateRequest(
            actorId,
            PlayerStateType.AWAITING_ANIMATION
        ));

        // キャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            const context = { isCancelled: true, cancelReason: cancelCheck.reason };
            
            // ログ用イベントコンポーネント生成
            const evt = this.world.createEntity();
            this.world.addComponent(evt, new ActionCancelledEvent(actorId, cancelCheck.reason));
            
            // キャンセル演出のリクエストへ
            this._requestVisuals(actorId, sequenceState, context);
            return;
        }

        // 移動後ターゲットの解決（ここでActionコンポーネントを更新）
        this._resolvePostMoveTargetForWorld(this.world, actorId);
        
        sequenceState.currentState = SequenceState.REQUEST_COMBAT;
    }

    _requestVisuals(actorId, sequenceState, context) {
        // コンテキスト保持
        sequenceState.contextData = context;

        // VisualSequenceSystem へリクエスト発行
        this.world.addComponent(actorId, new VisualSequenceRequest(context));
        sequenceState.currentState = SequenceState.WAITING_VISUALS;
    }

    _startTasks(actorId, sequenceState, visualTasks) {
        const tasks = [...visualTasks];
        const resultData = sequenceState.contextData;
        
        // 結果に含まれる状態更新指示をタスクとして挿入
        if (resultData && resultData.stateUpdates && resultData.stateUpdates.length > 0) {
            const commandTask = {
                type: 'CUSTOM',
                executeFn: (world) => {
                    this._applyStateUpdates(world, resultData.stateUpdates);
                }
            };

            // UIリフレッシュタスクの前に挿入して、見た目の反映前にデータを更新
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

    _applyStateUpdates(world, updates) {
        for (const update of updates) {
            const reqEntity = world.createEntity();
            switch (update.type) {
                case 'SetPlayerBroken':
                    world.addComponent(reqEntity, new SetPlayerBrokenRequest(update.targetId));
                    break;
                case 'ResetToCooldown':
                    world.addComponent(reqEntity, new ResetToCooldownRequest(update.targetId, update.options));
                    break;
                case 'TransitionState':
                    world.addComponent(reqEntity, new TransitionStateRequest(update.targetId, update.newState));
                    break;
                case 'UpdateComponent':
                    world.addComponent(reqEntity, new UpdateComponentRequest(update.targetId, update.componentType, update.updates));
                    break;
                case 'CustomUpdateComponent':
                    world.addComponent(reqEntity, new CustomUpdateComponentRequest(update.targetId, update.componentType, update.customHandler));
                    break;
                case 'TransitionToCooldown':
                    world.addComponent(reqEntity, new TransitionToCooldownRequest(update.targetId));
                    break;
                default:
                    console.warn(`BattleSequenceSystem: Unknown state update type "${update.type}"`);
                    world.destroyEntity(reqEntity);
            }
        }
    }

    _finalizeActorSequence(actorId) {
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

    abortSequence() {
        const pendingEntities = this.getEntities(SequencePending);
        for (const entityId of pendingEntities) {
            this.world.removeComponent(entityId, SequencePending);
        }

        const activeEntities = this.getEntities(BattleSequenceState);
        for (const entityId of activeEntities) {
            this.world.removeComponent(entityId, BattleSequenceState);
        }
        
        if (this.currentActorId) {
            this.world.removeComponent(this.currentActorId, VisualSequence);
        }
        
        this.currentActorId = null;
    }
}