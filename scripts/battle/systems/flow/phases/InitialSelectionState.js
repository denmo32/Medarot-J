/**
 * @file InitialSelectionState.js
 * @description 初期選択フェーズ（初手のアクション選択）。
 */
import { BaseState } from './BaseState.js';
import { BattlePhase, PlayerStateType } from '../../../common/constants.js';
import { GameState, Gauge, Action } from '../../../components/index.js';
import { GameEvents } from '../../../../common/events.js';
import { BattleStartState } from './BattleStartState.js';

export class InitialSelectionState extends BaseState {
    constructor(system) {
        super(system);
        this._isConfirming = false;
        this._confirmed = false;
        this._cancelled = false;

        this._onConfirm = this._onConfirm.bind(this);
        this._onCancel = this._onCancel.bind(this);
    }

    enter() {
        this.battleContext.phase = BattlePhase.INITIAL_SELECTION;
        this._initPlayers();
        this.world.on(GameEvents.BATTLE_START_CONFIRMED, this._onConfirm);
        this.world.on(GameEvents.BATTLE_START_CANCELLED, this._onCancel);
    }

    update(deltaTime) {
        if (this._confirmed) {
            return new BattleStartState(this.system);
        }

        if (this._cancelled) {
            // キャンセルされたら初期化し直す（実質リスタート）
            this._cancelled = false;
            this._isConfirming = false;
            this.world.emit(GameEvents.HIDE_MODAL);
            this.battleContext.isPaused = false;
            this._initPlayers();
            return null;
        }

        // 全員選択完了チェック
        if (!this._isConfirming && this._checkAllSelected()) {
            this._isConfirming = true;
            this.world.emit(GameEvents.SHOW_MODAL, { 
                type: 'battle_start_confirm',
                data: {},
                priority: 'high'
            });
            this.battleContext.isPaused = true; 
        }

        return null;
    }

    exit() {
        this.world.off(GameEvents.BATTLE_START_CONFIRMED, this._onConfirm);
        this.world.off(GameEvents.BATTLE_START_CANCELLED, this._onCancel);
        this.world.emit(GameEvents.HIDE_MODAL);
        this.battleContext.isPaused = false;
    }

    _initPlayers() {
        const players = this.system.getEntities(GameState, Gauge);
        const commands = [];
        
        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);
            
            commands.push({
                type: 'UPDATE_COMPONENT',
                targetId: id,
                componentType: Gauge,
                updates: { value: 0 }
            });

            if (gameState.state !== PlayerStateType.BROKEN) {
                commands.push({
                    type: 'TRANSITION_STATE',
                    targetId: id,
                    newState: PlayerStateType.READY_SELECT
                });
                commands.push({
                    type: 'UPDATE_COMPONENT',
                    targetId: id,
                    componentType: Gauge,
                    updates: { value: gauge.max, speedMultiplier: 1.0 }
                });
                commands.push({
                    type: 'UPDATE_COMPONENT',
                    targetId: id,
                    componentType: Action,
                    updates: new Action() // reset
                });

                this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId: id });
            }
        });

        if (commands.length > 0) {
            this.world.emit(GameEvents.EXECUTE_COMMANDS, commands);
        }
    }

    _checkAllSelected() {
        const allPlayers = this.system.getEntities(GameState);
        if (allPlayers.length === 0) return false;

        return allPlayers.every(id => {
            const state = this.world.getComponent(id, GameState);
            const unselectedStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
            return !unselectedStates.includes(state.state);
        });
    }

    _onConfirm() { this._confirmed = true; }
    _onCancel() { this._cancelled = true; }
}