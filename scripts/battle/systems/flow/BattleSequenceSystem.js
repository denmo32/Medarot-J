/**
 * @file BattleSequenceSystem.js
 * @description バトルアクションパイプラインの管理システム。
 * CancellationService, QueryServiceの置換。
 */
import { System } from '../../../../engine/core/System.js';
import {
    BattleSequenceState, SequencePending,
    Action, BattleFlowState, CombatContext, CombatResult,
    InCombatCalculation, GeneratingVisuals, ExecutingVisuals, SequenceFinished,
    IsReadyToExecute,
    // タグクラス定義
    IsShootingAction, IsMeleeAction, IsSupportAction, IsHealAction, IsDefendAction, IsInterruptAction,
    RequiresPreMoveTargeting, RequiresPostMoveTargeting,
    // タググループ
    ActionTypeTags, TargetingTags, SequencePhaseTags
} from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { TransitionStateRequest } from '../../components/CommandRequests.js';
import { ActionCancelledEvent } from '../../components/Requests.js';
import { PlayerStateType, BattlePhase, TargetTiming, ActionType } from '../../common/constants.js';
import { ValidationLogic } from '../../logic/ValidationLogic.js';
import { BattleQueries } from '../../queries/BattleQueries.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);
    }

    update(deltaTime) {
        this._handleGameOver();
        if (this.battleFlowState.phase !== BattlePhase.ACTION_EXECUTION) {
            return;
        }

        this._cleanupFinishedSequences();
        this._processInitializingSequences();

        if (!this._isPipelineBusy()) {
            this._startNextSequence();
        }

        this._markReadyEntities();
    }

    _handleGameOver() {
        if (this.battleFlowState.phase === BattlePhase.GAME_OVER) {
            this._abortAllSequences();
        }
    }

    _isPipelineBusy() {
        return this.getEntities(BattleSequenceState).length > 0;
    }

    _startNextSequence() {
        const nextActorId = this._getNextPendingEntity();
        if (nextActorId === null) return;

        this.world.removeComponent(nextActorId, SequencePending);
        this.world.addComponent(nextActorId, new BattleSequenceState());

        this.battleFlowState.currentActorId = nextActorId;
    }

    _processInitializingSequences() {
        const entities = this.world.getEntitiesWith(BattleSequenceState);
        
        for (const entityId of entities) {
            // 既にフェーズタグを持っている場合はスキップ（初期化済み）
            if (SequencePhaseTags.some(Tag => this.world.getComponent(entityId, Tag)) || 
                this.world.getComponent(entityId, SequenceFinished)) {
                continue;
            }

            const state = this.world.getComponent(entityId, BattleSequenceState);

            // 演出待機状態へ遷移
            const reqEntity = this.world.createEntity();
            this.world.addComponent(reqEntity, new TransitionStateRequest(
                entityId,
                PlayerStateType.AWAITING_ANIMATION
            ));

            // キャンセルチェック
            const cancelCheck = ValidationLogic.checkCancellation(this.world, entityId);
            if (cancelCheck.shouldCancel) {
                this._handleImmediateCancel(entityId, state, cancelCheck.reason);
            } else {
                const tagsApplied = this._applyActionTags(entityId);

                if (tagsApplied) {
                    this.world.addComponent(entityId, new InCombatCalculation());
                } else {
                    throw new Error(`Failed to apply action tags for entity ${entityId}`);
                }
            }
        }
    }

    _handleImmediateCancel(entityId, state, reason) {
        state.contextData = { isCancelled: true, cancelReason: reason };
        const evt = this.world.createEntity();
        this.world.addComponent(evt, new ActionCancelledEvent(entityId, reason));
        
        this.world.addComponent(entityId, new GeneratingVisuals());
    }

    _applyActionTags(entityId) {
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (!action || !parts || !action.partKey) return false;
        
        const partId = parts[action.partKey];
        const partData = BattleQueries.getPartData(this.world, partId);
        if (!partData) return false;

        // アクションタイプに応じたタグ付与
        const TagClass = this._getActionTagClass(partData.actionType);
        this.world.addComponent(entityId, new TagClass());

        // タイミングタグ付与
        if (partData.targetTiming === TargetTiming.POST_MOVE) {
            this.world.addComponent(entityId, new RequiresPostMoveTargeting());
        } else {
            this.world.addComponent(entityId, new RequiresPreMoveTargeting());
        }

        return true;
    }

    _getActionTagClass(actionType) {
        switch (actionType) {
            case ActionType.SHOOT: return IsShootingAction;
            case ActionType.MELEE: return IsMeleeAction;
            case ActionType.HEAL: return IsHealAction;
            case ActionType.SUPPORT: return IsSupportAction;
            case ActionType.INTERRUPT: return IsInterruptAction;
            case ActionType.DEFEND: return IsDefendAction;
            default:
                throw new Error(`Unknown action type: ${actionType}`);
        }
    }

    _cleanupFinishedSequences() {
        const entities = this.getEntities(SequenceFinished);
        for (const entityId of entities) {
            this._removeActionTags(entityId);
            this.world.removeComponent(entityId, SequenceFinished);
            this.world.removeComponent(entityId, BattleSequenceState);
            
            if (this.battleFlowState.currentActorId === entityId) {
                this.battleFlowState.currentActorId = null;
            }
        }
    }

    _removeActionTags(entityId) {
        // 定義されたタググループを使用して一括削除
        ActionTypeTags.forEach(Tag => this.world.removeComponent(entityId, Tag));
        TargetingTags.forEach(Tag => this.world.removeComponent(entityId, Tag));
        SequencePhaseTags.forEach(Tag => this.world.removeComponent(entityId, Tag));

        this.world.removeComponent(entityId, CombatContext);
        this.world.removeComponent(entityId, CombatResult);
    }

    _markReadyEntities() {
        const entities = this.getEntities(IsReadyToExecute);
        for (const id of entities) {
            const isPending = this.world.getComponent(id, SequencePending);
            const isRunning = this.world.getComponent(id, BattleSequenceState);

            if (!isPending && !isRunning) {
                this.world.addComponent(id, new SequencePending());
            }
        }
    }

    _getNextPendingEntity() {
        const pendingEntities = this.getEntities(SequencePending);
        if (pendingEntities.length === 0) return null;

        pendingEntities.sort(BattleQueries.compareByPropulsion(this.world));

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