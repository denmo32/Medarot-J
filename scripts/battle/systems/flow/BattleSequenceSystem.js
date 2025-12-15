/**
 * @file BattleSequenceSystem.js
 * @description バトルアクションパイプラインの「開始」と「終了」を管理するシステム。
 * アクターを選出しパイプラインへ投入(INITIALIZING)し、
 * 最終工程(FINISHED)に達したアクターをパイプラインから除外する。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, SequenceState, SequencePending,
    GameState, Action, TurnContext, PhaseState
} from '../../components/index.js';
import { Parts } from '../../../components/index.js'; // 修正: 共通コンポーネントはここからインポート
import { 
    TransitionStateRequest, ResetToCooldownRequest 
} from '../../components/CommandRequests.js';
import { ModalState } from '../../components/States.js';
import {
    ActionCancelledEvent, CheckActionCancellationRequest
} from '../../components/Requests.js';
import { PlayerStateType, BattlePhase, TargetTiming, ModalType } from '../../common/constants.js';
import { CancellationService } from '../../services/CancellationService.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
        this.turnContext = this.world.getSingletonComponent(TurnContext);
    }

    update(deltaTime) {
        // ゲームオーバー時は強制終了
        if (this.phaseState.phase === BattlePhase.GAME_OVER) {
            this._abortAllSequences();
            return;
        }

        // キャンセルチェックリクエストの処理 (随時)
        this._processCancellationRequests();

        // 実行フェーズでなければ何もしない
        if (this.phaseState.phase !== BattlePhase.ACTION_EXECUTION) {
            return;
        }

        // 1. パイプライン完了者の処理 (FINISHED -> 除去)
        this._cleanupFinishedSequences();

        // 2. パイプライン初期化処理 (INITIALIZING -> CALCULATING or GENERATING_VISUALS)
        this._processInitializingSequences();

        // 3. 新規アクターの投入 (Pending -> INITIALIZING)
        // 現在パイプラインで処理中のエンティティがいなければ、次を投入する
        if (!this._isPipelineBusy()) {
            this._startNextSequence();
        }
        
        // 4. 実行待機エンティティのタグ付け (まだPendingを持っていないREADY_EXECUTEがいれば)
        this._markReadyEntities();
    }

    // --- Core Logic ---

    _isPipelineBusy() {
        // 何らかのシーケンス状態を持っているエンティティがいればBusyとみなす
        return this.getEntities(BattleSequenceState).length > 0;
    }

    _startNextSequence() {
        const nextActorId = this._getNextPendingEntity();
        if (nextActorId === null) return;

        // Pendingタグを外し、SequenceState(INITIALIZING)を付与してパイプライン投入
        this.world.removeComponent(nextActorId, SequencePending);
        this.world.addComponent(nextActorId, new BattleSequenceState()); // Default is INITIALIZING
        
        this.turnContext.currentActorId = nextActorId;
    }

    _processInitializingSequences() {
        const entities = this.world.getEntitiesWith(BattleSequenceState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            if (state.currentState !== SequenceState.INITIALIZING) continue;

            // --- 初期化フェーズの処理 ---

            // 1. 状態遷移リクエスト (演出待ち状態へ)
            const reqEntity = this.world.createEntity();
            this.world.addComponent(reqEntity, new TransitionStateRequest(
                entityId,
                PlayerStateType.AWAITING_ANIMATION
            ));

            // 2. キャンセルチェック
            const cancelCheck = CancellationService.checkCancellation(this.world, entityId);
            if (cancelCheck.shouldCancel) {
                // キャンセル発生時
                state.contextData = { isCancelled: true, cancelReason: cancelCheck.reason };
                
                // ログイベント生成
                const evt = this.world.createEntity();
                this.world.addComponent(evt, new ActionCancelledEvent(entityId, cancelCheck.reason));
                
                // 計算フェーズをスキップして演出生成フェーズへ
                state.currentState = SequenceState.GENERATING_VISUALS;
            } else {
                // 正常進行時
                
                // 移動後ターゲットの解決（Actionコンポーネントの更新）
                this._resolvePostMoveTarget(entityId);
                
                // 計算フェーズへ
                state.currentState = SequenceState.CALCULATING;
            }
        }
    }

    _cleanupFinishedSequences() {
        const entities = this.world.getEntitiesWith(BattleSequenceState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            if (state.currentState === SequenceState.FINISHED) {
                // コンポーネント削除（パイプラインから脱出）
                this.world.removeComponent(entityId, BattleSequenceState);
                this.turnContext.currentActorId = null;
            }
        }
    }

    // --- Helpers ---

    _markReadyEntities() {
        const entities = this.world.getEntitiesWith(GameState);
        for (const id of entities) {
            const state = this.world.getComponent(id, GameState);
            const isReady = state.state === PlayerStateType.READY_EXECUTE;
            const isPending = this.world.getComponent(id, SequencePending);
            const isRunning = this.world.getComponent(id, BattleSequenceState);

            if (isReady && !isPending && !isRunning) {
                this.world.addComponent(id, new SequencePending());
            }
        }
    }

    _getNextPendingEntity() {
        const pendingEntities = this.getEntities(SequencePending);
        if (pendingEntities.length === 0) return null;

        // 推進力順にソート
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

    _resolvePostMoveTarget(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const parts = this.world.getComponent(attackerId, Parts);
        
        if (!action || !parts || !action.partKey) return;
        
        const attackingPart = parts[action.partKey];
        // 移動後ターゲット決定タイミング、かつターゲット未定の場合のみ
        if (!attackingPart || attackingPart.targetTiming !== TargetTiming.POST_MOVE || action.targetId !== null) return;

        const strategy = targetingStrategies[attackingPart.postMoveTargeting];
        if (strategy) {
            const targetData = strategy({ world: this.world, attackerId });
            if (targetData) {
                action.targetId = targetData.targetId;
                action.targetPartKey = targetData.targetPartKey;
            }
        }
    }

    _processCancellationRequests() {
        const requests = this.getEntities(CheckActionCancellationRequest);
        if (requests.length > 0) {
            this._checkActionCancellationGlobal();
            for (const id of requests) this.world.destroyEntity(id);
        }
    }

    _checkActionCancellationGlobal() {
        const actors = this.getEntities(GameState, Action);
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            // チャージ中のプレイヤーのみ対象
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) continue;

            const check = CancellationService.checkCancellation(this.world, actorId);
            
            if (check.shouldCancel) {
                // ログ
                const evt = this.world.createEntity();
                this.world.addComponent(evt, new ActionCancelledEvent(actorId, check.reason));
                
                // 通知メッセージ
                const message = CancellationService.getCancelMessage(this.world, actorId, check.reason);
                if (message) {
                    const msgReq = this.world.createEntity();
                    const stateEntity = this.world.createEntity();
                    const modalState = new ModalState();
                    modalState.type = ModalType.MESSAGE;
                    modalState.data = { message: message };
                    modalState.messageSequence = [{ text: message }];
                    modalState.priority = 'high';
                    // modalState.isNewはデフォルトでtrue
                    this.world.addComponent(stateEntity, modalState);
                }

                // 強制中断（クールダウンへ）
                const resetReq = this.world.createEntity();
                this.world.addComponent(resetReq, new ResetToCooldownRequest(actorId, { interrupted: true }));
            }
        }
    }

    _abortAllSequences() {
        const pending = this.getEntities(SequencePending);
        for (const id of pending) this.world.removeComponent(id, SequencePending);

        const active = this.getEntities(BattleSequenceState);
        for (const id of active) this.world.removeComponent(id, BattleSequenceState);
        
        this.turnContext.currentActorId = null;
    }
}