/**
 * @file BattleSequenceSystem.js
 * @description バトルアクションパイプラインの管理システム。
 * アクションタイプやタイミングの判定にQueryServiceを使用。
 */
import { System } from '../../../../engine/core/System.js';
import {
    BattleSequenceState, SequencePending,
    Action, BattleFlowState,
    IsShootingAction, IsMeleeAction, IsSupportAction, IsHealAction, IsDefendAction, IsInterruptAction,
    RequiresPreMoveTargeting, RequiresPostMoveTargeting,
    InCombatCalculation, GeneratingVisuals, ExecutingVisuals, SequenceFinished,
    IsReadyToExecute,
    TargetResolved, CombatContext, ProcessingEffects, CombatResult
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
import { QueryService } from '../../services/QueryService.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);
    }

    update(deltaTime) {
        if (this.battleFlowState.phase === BattlePhase.GAME_OVER) {
            this._abortAllSequences();
            return;
        }

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
            if (this.world.getComponent(entityId, InCombatCalculation) ||
                this.world.getComponent(entityId, GeneratingVisuals) ||
                this.world.getComponent(entityId, ExecutingVisuals) ||
                this.world.getComponent(entityId, SequenceFinished)) {
                continue;
            }

            const state = this.world.getComponent(entityId, BattleSequenceState);

            const reqEntity = this.world.createEntity();
            this.world.addComponent(reqEntity, new TransitionStateRequest(
                entityId,
                PlayerStateType.AWAITING_ANIMATION
            ));

            const cancelCheck = CancellationService.checkCancellation(this.world, entityId);
            if (cancelCheck.shouldCancel) {
                state.contextData = { isCancelled: true, cancelReason: cancelCheck.reason };
                const evt = this.world.createEntity();
                this.world.addComponent(evt, new ActionCancelledEvent(entityId, cancelCheck.reason));
                
                this.world.addComponent(entityId, new GeneratingVisuals());
            } else {
                const tagsApplied = this._applyActionTags(entityId);

                if (tagsApplied) {
                    this.world.addComponent(entityId, new InCombatCalculation());
                } else {
                    console.error(`BattleSequenceSystem: Failed to apply action tags for entity ${entityId}. Forcing cancel.`);
                    state.contextData = { isCancelled: true, cancelReason: 'INTERRUPTED' };
                    
                    const evt = this.world.createEntity();
                    this.world.addComponent(evt, new ActionCancelledEvent(entityId, 'INTERRUPTED'));
                    
                    this.world.addComponent(entityId, new GeneratingVisuals());
                }
            }
        }
    }

    _applyActionTags(entityId) {
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (!action || !parts || !action.partKey) return false;
        
        const partId = parts[action.partKey];
        const partData = QueryService.getPartData(this.world, partId);
        if (!partData) return false;

        switch (partData.actionType) {
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
                console.warn(`Unknown action type: ${partData.actionType}`);
                this.world.addComponent(entityId, new IsShootingAction());
                break;
        }

        if (partData.targetTiming === TargetTiming.POST_MOVE) {
            this.world.addComponent(entityId, new RequiresPostMoveTargeting());
        } else {
            this.world.addComponent(entityId, new RequiresPreMoveTargeting());
        }

        return true;
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
        this.world.removeComponent(entityId, IsShootingAction);
        this.world.removeComponent(entityId, IsMeleeAction);
        this.world.removeComponent(entityId, IsSupportAction);
        this.world.removeComponent(entityId, IsHealAction);
        this.world.removeComponent(entityId, IsDefendAction);
        this.world.removeComponent(entityId, IsInterruptAction);
        this.world.removeComponent(entityId, RequiresPreMoveTargeting);
        this.world.removeComponent(entityId, RequiresPostMoveTargeting);

        this.world.removeComponent(entityId, TargetResolved);
        this.world.removeComponent(entityId, CombatContext);
        this.world.removeComponent(entityId, ProcessingEffects);
        this.world.removeComponent(entityId, CombatResult);

        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.removeComponent(entityId, GeneratingVisuals);
        this.world.removeComponent(entityId, ExecutingVisuals);
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

        // Propulsionの比較もQueryServiceを使ってパーツIDから取得する必要がある
        // が、QueryService.compareByPropulsion ヘルパーがあるのでそれを使う
        pendingEntities.sort(QueryService.compareByPropulsion(this.world));

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