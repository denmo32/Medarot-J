/**
 * @file ActionSelectionSystem.js
 * @description アクション選択フェーズの制御を行うシステム。
 * イベント駆動からコンポーネントポーリングへ完全移行。
 */
import { System } from '../../../../engine/core/System.js';
import { TurnContext } from '../../components/TurnContext.js';
import { PhaseState } from '../../components/PhaseState.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, Gauge, GameState, ActionSelectionPending } from '../../components/index.js';
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
import { EffectService } from '../../services/EffectService.js';
import { QueryService } from '../../services/QueryService.js';

export class ActionSelectionSystem extends System {
    constructor(world) {
        super(world);
        this.turnContext = this.world.getSingletonComponent(TurnContext);
        this.phaseState = this.world.getSingletonComponent(PhaseState);

        this.initialSelectionState = {
            isConfirming: false,
            confirmed: false,
            cancelled: false
        };
    }

    update(deltaTime) {
        // 1. 状態処理 (フェーズに関わらず処理)
        this._processActionStates();
        this._processActionRequeueStates();
        this._processConfirmationTags();

        // 2. フェーズごとのロジック
        const currentPhase = this.phaseState.phase;

        if (currentPhase === BattlePhase.INITIAL_SELECTION) {
            this._updateInitialSelection();
        } else if (currentPhase === BattlePhase.ACTION_SELECTION) {
            this._updateActionSelection();
        }
    }

    // --- Request Processing ---

    _processActionStates() {
        const entities = this.getEntities(ActionState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, ActionState);
            if (state.state === 'selected') {
                this._handleActionState(state);
                // stateを更新
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
                if (this.turnContext.currentActorId === targetId) {
                    this.turnContext.currentActorId = null;
                }

                // 状態を更新
                state.isActive = false;
            }
        }
    }

    _processConfirmationTags() {
        // バトル開始確認
        const confirmedTags = this.getEntities(BattleStartConfirmedTag);
        if (confirmedTags.length > 0) {
            this.initialSelectionState.confirmed = true;
            for (const id of confirmedTags) this.world.destroyEntity(id);
        }

        // バトル開始キャンセル
        const cancelledTags = this.getEntities(BattleStartCancelledTag);
        if (cancelledTags.length > 0) {
            this.initialSelectionState.cancelled = true;
            for (const id of cancelledTags) this.world.destroyEntity(id);
        }
    }

    // --- Core Logic ---

    _handleActionState(state) {
        const { entityId, partKey, targetId, targetPartKey } = state;

        if (this.turnContext.currentActorId === entityId) {
            this.turnContext.selectedActions.set(entityId, state);
            this.turnContext.currentActorId = null; // 次へ
        }

        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        // バリデーション
        if (!partKey || !parts?.[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionSelectionSystem: Invalid part selected. Re-queueing.`);
            const stateEntity = this.world.createEntity();
            const actionRequeueState = new ActionRequeueState();
            actionRequeueState.isActive = true;
            actionRequeueState.entityId = entityId;
            this.world.addComponent(stateEntity, actionRequeueState);
            return;
        }

        const selectedPart = parts[partKey];

        // コンポーネント更新
        action.partKey = partKey;
        action.type = selectedPart.action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        action.targetTiming = selectedPart.targetTiming;

        // 速度計算
        const modifier = EffectService.getSpeedMultiplierModifier(this.world, entityId, selectedPart);
        const speedMultiplier = CombatCalculator.calculateSpeedMultiplier({
            might: selectedPart.might,
            success: selectedPart.success,
            factorType: 'charge',
            modifier: modifier
        });

        // 状態遷移リクエスト発行
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

    // --- INITIAL_SELECTION Logic ---
    _updateInitialSelection() {
        if (this.initialSelectionState.confirmed) {
            this.phaseState.phase = BattlePhase.BATTLE_START;
            this._resetInitialSelectionState();
            return;
        }

        if (this.initialSelectionState.cancelled) {
            this.initialSelectionState.cancelled = false;
            this.initialSelectionState.isConfirming = false;
            
            this.phaseState.phase = BattlePhase.IDLE;
            // シーン遷移はGameFlowSystem等で管理されるべきだが、ここではトリガーのみ変更
            // IDLEフェーズへの遷移をGameFlowSystemが検知する
            return;
        }

        if (!this.initialSelectionState.isConfirming && this._checkAllSelected()) {
            this.initialSelectionState.isConfirming = true;
            // モーダル表示リクエスト
            const stateEntity = this.world.createEntity();
            const modalState = new ModalState();
            modalState.type = ModalType.BATTLE_START_CONFIRM;
            modalState.data = {};
            modalState.priority = 'high';
            // modalState.isNewはデフォルトでtrue
            this.world.addComponent(stateEntity, modalState);
        }

        if (!this.initialSelectionState.isConfirming && this.turnContext.currentActorId === null) {
            this._processNextActor(true); // isInitial=true
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
        const allPlayers = this.getEntities(GameState);
        if (allPlayers.length === 0) return false;

        return allPlayers.every(id => {
            const state = this.world.getComponent(id, GameState);
            if (!state) return false;
            return state.state === PlayerStateType.SELECTED_CHARGING || 
                   state.state === PlayerStateType.BROKEN;
        });
    }

    // --- ACTION_SELECTION Logic ---
    _updateActionSelection() {
        // 現在のアクターが行動選択中でなければ、次のアクターを選出する
        if (this.turnContext.currentActorId === null) {
            this._processNextActor(false);
        }
    }

    _processNextActor(isInitial) {
        const pendingEntities = this.getEntities(ActionSelectionPending);
        if (pendingEntities.length === 0) return;

        // 有効な候補をフィルタリング
        const validEntities = pendingEntities.filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state && state.state === PlayerStateType.READY_SELECT;
        });

        if (validEntities.length === 0) return;

        // ソート
        if (isInitial) {
            validEntities.sort((a, b) => a - b);
        } else {
            validEntities.sort(QueryService.compareByPropulsion(this.world));
        }

        const nextActorId = validEntities[0];
        
        // 選択権の付与
        this.turnContext.currentActorId = nextActorId;
        this.world.removeComponent(nextActorId, ActionSelectionPending);

        this._triggerInput(nextActorId);
    }

    _triggerInput(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        
        if (playerInfo.teamId === 'team1') {
            // プレイヤー入力要求リクエストを発行
            const req = this.world.createEntity();
            const stateEntity = this.world.createEntity();
            const playerInputState = new PlayerInputState();
            playerInputState.isActive = true;
            playerInputState.entityId = entityId;
            this.world.addComponent(stateEntity, playerInputState);
        } else {
            // AIリクエスト発行
            const aiActionState = new AiActionState();
            aiActionState.isActive = true;
            this.world.addComponent(entityId, aiActionState);
        }
    }
}