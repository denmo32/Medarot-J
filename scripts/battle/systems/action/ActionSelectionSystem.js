/**
 * @file ActionSelectionSystem.js
 * @description アクション選択フェーズの制御を行うシステム。
 * BattleStateContext への依存を削除し、PauseState を参照するように変更。
 */
import { System } from '../../../../engine/core/System.js';
import { TurnContext } from '../../components/TurnContext.js';
import { PhaseState } from '../../components/PhaseState.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, Gauge, GameState, PauseState } from '../../components/index.js'; // 追加
import { TransitionStateRequest, UpdateComponentRequest } from '../../components/CommandRequests.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectService } from '../../services/EffectService.js';

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
        this.on(GameEvents.NEXT_ACTOR_DETERMINED, this.onNextActorDetermined.bind(this));
        this.on(GameEvents.BATTLE_START_CONFIRMED, () => { this.initialSelectionState.confirmed = true; });
        this.on(GameEvents.BATTLE_START_CANCELLED, () => { this.initialSelectionState.cancelled = true; });
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
            this.world.emit(GameEvents.HIDE_MODAL);
            
            // Resume処理はGameFlowSystemがイベントを受けてPauseStateを削除することで行われる
            this.world.emit(GameEvents.GAME_RESUMED);
            
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
            // Pause処理はGameFlowSystemがイベントを受けてPauseStateを付与することで行われる
            this.world.emit(GameEvents.GAME_PAUSED);
        }
    }

    _resetInitialSelectionState() {
        this.initialSelectionState = {
            isConfirming: false,
            confirmed: false,
            cancelled: false
        };
        this.world.emit(GameEvents.HIDE_MODAL);
        this.world.emit(GameEvents.GAME_RESUMED);
    }

    _checkAllSelected() {
        const allPlayers = this.getEntities(GameState);
        if (allPlayers.length === 0) return false;

        return allPlayers.every(id => {
            const state = this.world.getComponent(id, GameState);
            const unselectedStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
            return !unselectedStates.includes(state.state);
        });
    }

    // --- ACTION_SELECTION Logic ---
    _updateActionSelection() {
        if (this._isAnyEntityReadyToExecute()) {
            this.phaseState.phase = BattlePhase.ACTION_EXECUTION;
            return;
        }

        if (!this._isAnyEntityInAction()) {
            this.phaseState.phase = BattlePhase.TURN_END;
        }
    }

    _isAnyEntityReadyToExecute() {
        const entities = this.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });
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

    // --- Event Handlers ---
    onNextActorDetermined(detail) {
        const { entityId } = detail;
        this.turnContext.currentActorId = entityId;
        this.triggerActionSelection(entityId);
    }

    triggerActionSelection(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const eventToEmit = playerInfo.teamId === 'team1'
            ? GameEvents.PLAYER_INPUT_REQUIRED
            : GameEvents.AI_ACTION_REQUIRED;

        this.world.emit(eventToEmit, { entityId });
    }

    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;

        if (this.turnContext.currentActorId === entityId) {
            this.turnContext.selectedActions.set(entityId, detail);
            this.turnContext.currentActorId = null;
        }

        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (!partKey || !parts?.[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionSelectionSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
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
}