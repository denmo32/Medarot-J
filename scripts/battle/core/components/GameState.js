import { PlayerStateType, PartType, TeamID, TargetTiming } from '../../common/constants.js';

// ゲームの状態
export class GameState {
    /**
     * @param {PlayerStateType} initialState - 状態の初期値
     */
    // 状態の初期値を定数で指定
    constructor(initialState = PlayerStateType.CHARGING) {
        /** @type {PlayerStateType} */
        this.state = initialState; // charging, ready_select, selected_charging, ready_execute, cooldown_complete, broken
    }
}