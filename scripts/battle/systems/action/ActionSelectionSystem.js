/**
 * @file ActionSelectionSystem.js
 * @description アクション選択フェーズの制御を行うシステム。
 * 旧 ActionSelectionState, InitialSelectionState のロジックを統合。
 */
import { System } from '../../../../engine/core/System.js';
import { TurnContext } from '../../components/TurnContext.js';
import { PhaseContext } from '../../components/PhaseContext.js';
import { BattleStateContext } from '../../components/BattleStateContext.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, Gauge, GameState } from '../../components/index.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectService } from '../../services/EffectService.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';

export class ActionSelectionSystem extends System {
    constructor(world) {
        super(world);
        this.turnContext = this.world.getSingletonComponent(TurnContext);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        this.battleStateContext = this.world.getSingletonComponent(BattleStateContext);

        // InitialSelection用の状態管理
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
        
        // InitialSelection用イベント
        this.on(GameEvents.BATTLE_START_CONFIRMED, () => { this.initialSelectionState.confirmed = true; });
        this.on(GameEvents.BATTLE_START_CANCELLED, () => { this.initialSelectionState.cancelled = true; });
    }

    update(deltaTime) {
        const currentPhase = this.phaseContext.phase;

        if (currentPhase === BattlePhase.INITIAL_SELECTION) {
            this._updateInitialSelection();
        } else if (currentPhase === BattlePhase.ACTION_SELECTION) {
            this._updateActionSelection();
        }
    }

    // --- INITIAL_SELECTION Logic ---
    _updateInitialSelection() {
        // 1. 確定済み -> バトル開始フェーズへ
        if (this.initialSelectionState.confirmed) {
            this.phaseContext.phase = BattlePhase.BATTLE_START;
            this._resetInitialSelectionState();
            return;
        }

        // 2. キャンセル -> 初期化し直し（リスタート）
        if (this.initialSelectionState.cancelled) {
            this.initialSelectionState.cancelled = false;
            this.initialSelectionState.isConfirming = false;
            this.world.emit(GameEvents.HIDE_MODAL);
            this.battleStateContext.isPaused = false;
            
            // 再初期化処理は GameFlowSystem の _onPhaseEnter(INITIAL_SELECTION) を再度走らせるため、
            // 一度フェーズを変更するか、初期化ロジックをリクエストする必要がある。
            // ここでは簡易的に、現在のフェーズを再設定して GameFlowSystem に検知させることはできない（同じ値のため）。
            // したがって、GameFlowSystemのメソッドを呼べないので、初期化イベントを発行するか、
            // ここで初期化ロジックを持つ必要があるが、依存を避けるため
            // 一瞬 IDLE に戻して即座に INITIAL_SELECTION に戻すなどのハックよりは、
            // GameFlowSystemがリセット要求イベントをリッスンする方が良いが、
            // 今回は簡易的に GameFlowSystem の初期化ロジック相当（TRANSITION_STATE等）は
            // GameFlowSystemに任せたい。
            // 解決策: IDLEに戻し、GameStartConfirmedイベントを再発行してループさせる。
            this.phaseContext.phase = BattlePhase.IDLE;
            this.world.emit(GameEvents.GAME_START_CONFIRMED);
            return;
        }

        // 3. 全員選択完了チェック
        if (!this.initialSelectionState.isConfirming && this._checkAllSelected()) {
            this.initialSelectionState.isConfirming = true;
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: 'battle_start_confirm',
                data: {},
                priority: 'high'
            });
            this.battleStateContext.isPaused = true;
        }
    }

    _resetInitialSelectionState() {
        this.initialSelectionState = {
            isConfirming: false,
            confirmed: false,
            cancelled: false
        };
        this.world.emit(GameEvents.HIDE_MODAL);
        this.battleStateContext.isPaused = false;
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
        // 1. 実行待機状態(READY_EXECUTE)のエンティティがいるかチェック -> 実行フェーズへ
        if (this._isAnyEntityReadyToExecute()) {
            this.phaseContext.phase = BattlePhase.ACTION_EXECUTION;
            return;
        }

        // 2. 誰もチャージ中でなく、誰も選択待機中でない -> ターン終了へ
        // (全員行動済み、または全員破壊された場合など)
        if (!this._isAnyEntityInAction()) {
            this.phaseContext.phase = BattlePhase.TURN_END;
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
            // チャージ中、選択待機中、選択決定後チャージ中
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

        const commands = [
            createCommand('TRANSITION_STATE', {
                targetId: entityId,
                newState: PlayerStateType.SELECTED_CHARGING
            }),
            createCommand('UPDATE_COMPONENT', {
                targetId: entityId,
                componentType: Gauge,
                updates: {
                    value: 0,
                    currentSpeed: 0,
                    speedMultiplier: speedMultiplier
                }
            })
        ];
        CommandExecutor.executeCommands(this.world, commands);
    }
}