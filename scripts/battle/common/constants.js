/**
 * @file 戦闘シーン固有の定数定義
 * @description ゲーム全体の定数は `scripts/common/constants.js` に定義し、
 * ここでは戦闘シーン特有の状態定義などを定義します。
 */

/**
 * ゲーム全体の状態（フェーズ）を定義する定数
 */
export const BattlePhase = {
    IDLE: 'IDLE',
    BATTLE_START: 'BATTLE_START',
    INITIAL_SELECTION: 'INITIAL_SELECTION',
    TURN_START: 'TURN_START',
    ACTION_SELECTION: 'ACTION_SELECTION',
    ACTION_EXECUTION: 'ACTION_EXECUTION',
    TURN_END: 'TURN_END',
    GAME_OVER: 'GAME_OVER'
};

/**
 * 各プレイヤーの状態を定義する定数
 */
export const PlayerStateType = {
    CHARGING: 'charging',
    READY_SELECT: 'ready_select',
    SELECTED_CHARGING: 'selected_charging',
    READY_EXECUTE: 'ready_execute',
    AWAITING_ANIMATION: 'awaiting_animation',
    COOLDOWN_COMPLETE: 'cooldown_complete',
    BROKEN: 'broken',
    GUARDING: 'guarding',
};

/**
 * モーダルの種類を定義する定数
 */
export const ModalType = {
    START_CONFIRM: 'start_confirm',
    SELECTION: 'selection',
    ATTACK_DECLARATION: 'attack_declaration',
    EXECUTION_RESULT: 'execution_result',
    BATTLE_START_CONFIRM: 'battle_start_confirm',
    GAME_OVER: 'game_over',
    MESSAGE: 'message'
};

/**
 * アクションキャンセルの理由を定義する定数
 */
export const ActionCancelReason = {
    PART_BROKEN: 'PART_BROKEN',
    TARGET_LOST: 'TARGET_LOST',
    INTERRUPTED: 'INTERRUPTED',
};