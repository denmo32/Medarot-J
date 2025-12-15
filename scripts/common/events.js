/**
 * @file ゲームイベント定義
 * システム間の通信に使用されるイベントを定義します。
 */

/**
 * @enum {Object} GameEvents
 * @description ゲーム内で発生する全イベントを定義します。
 */
export const GameEvents = {
    // --- ゲームフローイベント ---
    RESET_BUTTON_CLICKED: 'RESET_BUTTON_CLICKED',
    BATTLE_START_CANCELLED: 'BATTLE_START_CANCELLED',
    BATTLE_START_CONFIRMED: 'BATTLE_START_CONFIRMED',

	// --- プレイヤー入力 ---
    PART_SELECTED: 'PART_SELECTED',
    ACTION_SELECTED: 'ACTION_SELECTED',

    // --- 状態 & ターン管理イベント ---
    TURN_START: 'TURN_START',
    TURN_END: 'TURN_END',

    ACTION_CANCELLED: 'ACTION_CANCELLED',
    PART_BROKEN: 'PART_BROKEN',
    PLAYER_BROKEN: 'PLAYER_BROKEN',
    GAME_OVER: 'GAME_OVER',
    HP_UPDATED: 'HP_UPDATED',

    // --- UI & Sceneイベント ---
    SHOW_MODAL: 'SHOW_MODAL',
    HIDE_MODAL: 'HIDE_MODAL',
};