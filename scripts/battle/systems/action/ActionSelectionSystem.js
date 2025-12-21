/**
 * @file ActionSelectionSystem.js
 * @description アクション選択フェーズの制御システム。
 * QueryService -> BattleQueries
 * CombatCalculator, EffectService -> StatCalculator, CombatCalculator
 */
import { System } from '../../../../engine/core/System.js';
import { BattleFlowState } from '../../components/BattleFlowState.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, Gauge, ActionSelectionPending, IsReadyToSelect, IsCharging, IsBroken } from '../../components/index.js';
import {
    TransitionStateRequest,
    UpdateComponentRequest
} from '../../components/CommandRequests.js';
import { ModalState, ActionState, ActionRequeueState, PlayerInputState, AiActionState } from '../../components/States.js';
import {
    BattleStartConfirmedTag,
    BattleStartCancelledTag
} from '../../components/Requests.js';
import { PlayerStateType, BattlePhase, ModalType } from '../../common/constants.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { StatCalculator } from '../../logic/StatCalculator.js';
import { BattleQueries } from '../../queries/BattleQueries.js';

export class ActionSelectionSystem extends System {
    constructor(world) {
        super(world);
        this.battleFlowState = this.world.getSingletonComponent(BattleFlowState);

        this.initialSelectionState = {
            isConfirming: false,
            confirmed: false,
            cancelled: false
        };
    }

    update(deltaTime) {
        this._processActionStates();
        this._processActionRequeueStates();
        this._processConfirmationTags();

        const currentPhase = this.battleFlowState.phase;

        if (currentPhase === BattlePhase.INITIAL_SELECTION) {
            this._updateInitialSelection();
        } else if (currentPhase === BattlePhase.ACTION_SELECTION) {
            this._updateActionSelection();
        }
    }

    _processActionStates() {
        const entities = this.getEntities(ActionState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, ActionState);
            if (state.state === 'selected') {
                this._handleActionState(state);
                state.state = 'processed';
            }
        }
    }

    _processActionRequeueStates() {
        const entities = this.getEntities(ActionRequeueState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, ActionRequeueState);
            if (state.isActive) {
                const { entityId: targetId } = state;

                if (!this.world.getComponent(targetId, ActionSelectionPending)) {
                    this.world.addComponent(targetId, new ActionSelectionPending());
                }
                if (this.battleFlowState.currentActorId === targetId) {
                    this.battleFlowState.currentActorId = null;
                }

                state.isActive = false;
            }
        }
    }

    _processConfirmationTags() {
        const confirmedTags = this.getEntities(BattleStartConfirmedTag);
        if (confirmedTags.length > 0) {
            this.initialSelectionState.confirmed = true;
            for (const id of confirmedTags) this.world.destroyEntity(id);
        }

        const cancelledTags = this.getEntities(BattleStartCancelledTag);
        if (cancelledTags.length > 0) {
            this.initialSelectionState.cancelled = true;
            for (const id of cancelledTags) this.world.destroyEntity(id);
        }
    }

    _handleActionState(state) {
        const { entityId, partKey, targetId, targetPartKey } = state;

        if (this.battleFlowState.currentActorId === entityId) {
            this.battleFlowState.currentActorId = null;
        }

        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (!partKey || !parts) {
            this._triggerRequeue(entityId);
            return;
        }

        const partId = parts[partKey];
        const selectedPart = BattleQueries.getPartData(this.world, partId);

        if (!selectedPart || selectedPart.isBroken) {
            console.warn(`ActionSelectionSystem: Invalid part selected. Re-queueing.`);
            this._triggerRequeue(entityId);
            return;
        }

        action.partKey = partKey;
        action.type = selectedPart.action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        action.targetTiming = selectedPart.targetTiming;

        const modifier = StatCalculator.getSpeedMultiplierModifier(this.world, entityId, selectedPart);
        const speedMultiplier = CombatCalculator.calculateSpeedMultiplier({
            might: selectedPart.might,
            success: selectedPart.success,
            factorType: 'charge',
            modifier: modifier
        });

        // 状態遷移: SELECTED_CHARGING -> IsCharging
        const req1 = this.world.createEntity();
        this.world.addComponent(req1, new TransitionStateRequest(
            entityId,
            PlayerStateType.SELECTED_CHARGING
        ));

        const req2 = this.world.createEntity();
        this.world.addComponent(req2, new UpdateComponentRequest(
            entityId,
            Gauge,
            {
                value: 0,
                currentSpeed: 0,
                speedMultiplier: speedMultiplier
            }
        ));
    }

    _triggerRequeue(entityId) {
        const stateEntity = this.world.createEntity();
        const actionRequeueState = new ActionRequeueState();
        actionRequeueState.isActive = true;
        actionRequeueState.entityId = entityId;
        this.world.addComponent(stateEntity, actionRequeueState);
    }

    _updateInitialSelection() {
        if (this.initialSelectionState.confirmed) {
            this.battleFlowState.phase = BattlePhase.BATTLE_START;
            this._resetInitialSelectionState();
            return;
        }

        if (this.initialSelectionState.cancelled) {
            this.initialSelectionState.cancelled = false;
            this.initialSelectionState.isConfirming = false;
            this.battleFlowState.phase = BattlePhase.IDLE;
            return;
        }

        if (!this.initialSelectionState.isConfirming && this._checkAllSelected()) {
            this.initialSelectionState.isConfirming = true;
            const stateEntity = this.world.createEntity();
            const modalState = new ModalState();
            modalState.type = ModalType.BATTLE_START_CONFIRM;
            modalState.data = {};
            modalState.priority = 'high';
            this.world.addComponent(stateEntity, modalState);
        }

        if (!this.initialSelectionState.isConfirming && this.battleFlowState.currentActorId === null) {
            this._processNextActor(true); 
        }
    }

    _resetInitialSelectionState() {
        this.initialSelectionState = {
            isConfirming: false,
            confirmed: false,
            cancelled: false
        };
    }

    _checkAllSelected() {
        const charging = this.getEntities(IsCharging);
        const broken = this.getEntities(IsBroken);
        const totalChecked = charging.length + broken.length;
        
        const pending = this.getEntities(IsReadyToSelect);
        return pending.length === 0 && totalChecked > 0;
    }

    _updateActionSelection() {
        if (this.battleFlowState.currentActorId === null) {
            this._processNextActor(false);
        }
    }

    _processNextActor(isInitial) {
        const pendingEntities = this.getEntities(ActionSelectionPending);
        if (pendingEntities.length === 0) return;

        const validEntities = pendingEntities.filter(id => this.world.getComponent(id, IsReadyToSelect));

        if (validEntities.length === 0) return;

        if (isInitial) {
            validEntities.sort((a, b) => a - b);
        } else {
            validEntities.sort(BattleQueries.compareByPropulsion(this.world));
        }

        const nextActorId = validEntities[0];

        this.battleFlowState.currentActorId = nextActorId;
        this.world.removeComponent(nextActorId, ActionSelectionPending);

        this._triggerInput(nextActorId);
    }

    _triggerInput(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        if (playerInfo.teamId === 'team1') {
            const stateEntity = this.world.createEntity();
            const playerInputState = new PlayerInputState();
            playerInputState.isActive = true;
            playerInputState.entityId = entityId;
            this.world.addComponent(stateEntity, playerInputState);
        } else {
            const aiActionState = new AiActionState();
            aiActionState.isActive = true;
            this.world.addComponent(entityId, aiActionState);
        }
    }
}