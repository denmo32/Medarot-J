/**
 * @file IdleState.js
 * @description アイドル状態（バトル開始前）。
 */
import { BaseState } from './BaseState.js';
import { GameEvents } from '../../../../common/events.js';
import { BattlePhase } from '../../../common/constants.js';
import { InitialSelectionState } from './InitialSelectionState.js';

export class IdleState extends BaseState {
    constructor(system) {
        super(system);
        this._isConfirmed = false;
        // イベントバインドの管理
        this._onGameStartConfirmed = this._onGameStartConfirmed.bind(this);
    }

    enter() {
        this.battleContext.phase = BattlePhase.IDLE;
        this.world.on(GameEvents.GAME_START_CONFIRMED, this._onGameStartConfirmed);
    }

    update(deltaTime) {
        if (this._isConfirmed) {
            return new InitialSelectionState(this.system);
        }
        return null;
    }

    exit() {
        this.world.off(GameEvents.GAME_START_CONFIRMED, this._onGameStartConfirmed);
    }

    _onGameStartConfirmed() {
        this._isConfirmed = true;
    }
}