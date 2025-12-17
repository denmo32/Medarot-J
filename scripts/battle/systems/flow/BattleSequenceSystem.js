/**
 * @file BattleSequenceSystem.js
 * @description バトルアクションパイプラインの管理システム。
 * パス修正: index.js経由でコンポーネントをインポートするように統一。
 */
import { System } from '../../../../engine/core/System.js';
import {
    BattleSequenceState, SequenceState, SequencePending,
    GameState, Action, BattleFlowState,
    IsShootingAction, IsMeleeAction, IsSupportAction, IsHealAction, IsDefendAction, IsInterruptAction,
    RequiresPreMoveTargeting, RequiresPostMoveTargeting
} from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import {
    TransitionStateRequest
} from '../../components/CommandRequests.js';
import {
    ActionCancelledEvent
} from '../../components/Requests.js';
import { PlayerStateType, BattlePhase, TargetTiming, ActionType } from '../../common/constants.js';
import { CancellationService } from '../../services/CancellationService.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);
    }

    update(deltaTime) {
        // ゲームオーバー時は強制終了
        if (this.battleFlowState.phase === BattlePhase.GAME_OVER) {
            this._abortAllSequences();
            return;
        }

        // 実行フェーズでなければ何もしない
        if (this.battleFlowState.phase !== BattlePhase.ACTION_EXECUTION) {
            return;
        }

        // 1. パイプライン完了者の処理 (FINISHED -> 除去)
        this._cleanupFinishedSequences();

        // 2. パイプライン初期化処理 (INITIALIZING -> CALCULATING or GENERATING_VISUALS)
        this._processInitializingSequences();

        // 3. 新規アクターの投入 (Pending -> INITIALIZING)
        if (!this._isPipelineBusy()) {
            this._startNextSequence();
        }

        // 4. 実行待機エンティティのタグ付け
        this._markReadyEntities();
    }

    _isPipelineBusy() {
        return this.getEntities(BattleSequenceState).length > 0;
    }

    _startNextSequence() {
        const nextActorId = this._getNextPendingEntity();
        if (nextActorId === null) return;

        this.world.removeComponent(nextActorId, SequencePending);
        this.world.addComponent(nextActorId, new BattleSequenceState()); // Default is INITIALIZING

        this.battleFlowState.currentActorId = nextActorId;
    }

    _processInitializingSequences() {
        const entities = this.world.getEntitiesWith(BattleSequenceState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            if (state.currentState !== SequenceState.INITIALIZING) continue;

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
                const evt = this.world.createEntity();
                this.world.addComponent(evt, new ActionCancelledEvent(entityId, cancelCheck.reason));
                
                state.currentState = SequenceState.GENERATING_VISUALS;
            } else {
                // 3. アクション特性に基づくタグの付与
                this._applyActionTags(entityId);

                // 計算フェーズへ
                state.currentState = SequenceState.CALCULATING;
            }
        }
    }

    /**
     * アクションの定義に基づいて、エンティティに適切なタグコンポーネントを付与する
     */
    _applyActionTags(entityId) {
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (!action || !parts || !action.partKey) return;
        
        const part = parts[action.partKey];
        if (!part) return;

        // アクション種別タグの付与
        switch (part.actionType) {
            case ActionType.SHOOT:
                this.world.addComponent(entityId, new IsShootingAction());
                break;
            case ActionType.MELEE:
                this.world.addComponent(entityId, new IsMeleeAction());
                break;
            case ActionType.HEAL:
                this.world.addComponent(entityId, new IsHealAction());
                break;
            case ActionType.SUPPORT:
                this.world.addComponent(entityId, new IsSupportAction());
                break;
            case ActionType.INTERRUPT:
                this.world.addComponent(entityId, new IsInterruptAction());
                break;
            case ActionType.DEFEND:
                this.world.addComponent(entityId, new IsDefendAction());
                break;
            default:
                console.warn(`Unknown action type: ${part.actionType}`);
                this.world.addComponent(entityId, new IsShootingAction());
                break;
        }

        // ターゲットタイミングタグの付与
        if (part.targetTiming === TargetTiming.POST_MOVE) {
            this.world.addComponent(entityId, new RequiresPostMoveTargeting());
        } else {
            this.world.addComponent(entityId, new RequiresPreMoveTargeting());
        }
    }

    _cleanupFinishedSequences() {
        const entities = this.world.getEntitiesWith(BattleSequenceState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            if (state.currentState === SequenceState.FINISHED) {
                // タグコンポーネントの削除
                this._removeActionTags(entityId);

                this.world.removeComponent(entityId, BattleSequenceState);
                this.battleFlowState.currentActorId = null;
            }
        }
    }

    _removeActionTags(entityId) {
        this.world.removeComponent(entityId, IsShootingAction);
        this.world.removeComponent(entityId, IsMeleeAction);
        this.world.removeComponent(entityId, IsSupportAction);
        this.world.removeComponent(entityId, IsHealAction);
        this.world.removeComponent(entityId, IsDefendAction);
        this.world.removeComponent(entityId, IsInterruptAction);
        this.world.removeComponent(entityId, RequiresPreMoveTargeting);
        this.world.removeComponent(entityId, RequiresPostMoveTargeting);
    }

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

    _abortAllSequences() {
        const pending = this.getEntities(SequencePending);
        for (const id of pending) this.world.removeComponent(id, SequencePending);

        const active = this.getEntities(BattleSequenceState);
        for (const id of active) {
            this._removeActionTags(id);
            this.world.removeComponent(id, BattleSequenceState);
        }

        this.battleFlowState.currentActorId = null;
    }
}