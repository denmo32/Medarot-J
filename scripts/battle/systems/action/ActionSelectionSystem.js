/**
 * @file ActionSelectionSystem.js
 * @description アクション選択フェーズの制御を行うシステム。
 * イベント駆動からループ監視による自律的なアクター選出へ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { TurnContext } from '../../components/TurnContext.js';
import { PhaseState } from '../../components/PhaseState.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, Gauge, GameState, ActionSelectionPending, AiActionRequest } from '../../components/index.js';
import { TransitionStateRequest, UpdateComponentRequest } from '../../components/CommandRequests.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
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

        this._bindEvents();
    }

    _bindEvents() {
        this.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.on(GameEvents.BATTLE_START_CONFIRMED, () => { this.initialSelectionState.confirmed = true; });
        this.on(GameEvents.BATTLE_START_CANCELLED, () => { this.initialSelectionState.cancelled = true; });
        this.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
        // ACTION_QUEUE_REQUEST のハンドラを追加
        this.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
    }

    update(deltaTime) {
        const currentPhase = this.phaseState.phase;

        if (currentPhase === BattlePhase.INITIAL_SELECTION) {
            this._updateInitialSelection();
        } else if (currentPhase === BattlePhase.ACTION_SELECTION) {
            this._updateActionSelection();
        }
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
            this.world.emit(GameEvents.GAME_START_CONFIRMED);
            return;
        }

        if (!this.initialSelectionState.isConfirming && this._checkAllSelected()) {
            this.initialSelectionState.isConfirming = true;
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: 'battle_start_confirm',
                data: {},
                priority: 'high'
            });
            this.world.emit(GameEvents.GAME_PAUSED);
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

    /**
     * 次の行動選択待ちアクターを選出し、入力要求を行う
     * @param {boolean} isInitial 初期選択フェーズかどうか
     */
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
            this.world.emit(GameEvents.PLAYER_INPUT_REQUIRED, { entityId });
        } else {
            this.world.addComponent(entityId, new AiActionRequest());
        }
    }

    // --- Event Handlers ---
    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;

        if (this.turnContext.currentActorId === entityId) {
            this.turnContext.selectedActions.set(entityId, detail);
            this.turnContext.currentActorId = null; // 次へ
        }

        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (!partKey || !parts?.[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionSelectionSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.addComponent(entityId, new ActionSelectionPending());
            if (this.turnContext.currentActorId === entityId) {
                this.turnContext.currentActorId = null;
            }
            return;
        }

        const selectedPart = parts[partKey];

        action.partKey = partKey;
        action.type = selectedPart.action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        action.targetTiming = selectedPart.targetTiming;

        const modifier = EffectService.getSpeedMultiplierModifier(this.world, entityId, selectedPart);
        const speedMultiplier = CombatCalculator.calculateSpeedMultiplier({
            might: selectedPart.might,
            success: selectedPart.success,
            factorType: 'charge',
            modifier: modifier
        });

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

    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        if (!this.world.getComponent(entityId, ActionSelectionPending)) {
            this.world.addComponent(entityId, new ActionSelectionPending());
        }
        if (this.turnContext.currentActorId === entityId) {
            this.turnContext.currentActorId = null;
        }
    }

    // StateTransitionSystem 等からの要求を受け、選択待ちキューに入れる
    onActionQueueRequest(detail) {
        const { entityId } = detail;
        if (!this.world.getComponent(entityId, ActionSelectionPending)) {
            this.world.addComponent(entityId, new ActionSelectionPending());
        }
    }
}