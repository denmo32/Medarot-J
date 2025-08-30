// scripts/events.js:

/**
 * ゲーム内で発生するイベントを定義します。
 * これにより、システム間の疎結合を実現します。
 */
export const GameEvents = {
    // --- Game Flow Events ---
    GAME_START_REQUESTED: 'GAME_START_REQUESTED',       // ★変更: 開始アイコンがクリックされた
    GAME_START_CONFIRMED: 'GAME_START_CONFIRMED',       // ★追加: 開始確認モーダルで「はい」が押された
    RESET_BUTTON_CLICKED: 'RESET_BUTTON_CLICKED', // リセットボタンがクリックされた
    BATTLE_START_CONFIRMED: 'BATTLE_START_CONFIRMED', // 「ロボトルファイト！」がクリックされた

    // --- Player Input & AI Events ---
    PLAYER_INPUT_REQUIRED: 'PLAYER_INPUT_REQUIRED', // プレイヤーの行動選択が必要になった
    AI_ACTION_REQUIRED: 'AI_ACTION_REQUIRED',       // AIの行動選択が必要になった
    ACTION_SELECTED: 'ACTION_SELECTED',             // プレイヤーまたはAIが行動を決定した

    // --- Action Execution Events ---
    ACTION_EXECUTION_CONFIRMED: 'ACTION_EXECUTION_CONFIRMED', // 攻撃モーダルのOKが押された
    ACTION_EXECUTED: 'ACTION_EXECUTED',                       // 行動が実行され、ダメージなどが計算された

    // --- State Change Events ---
    PART_BROKEN: 'PART_BROKEN',         // パーツが破壊された
    PLAYER_BROKEN: 'PLAYER_BROKEN',     // プレイヤー（頭部）が破壊された
    GAME_OVER: 'GAME_OVER',             // ゲームが終了した

    // --- UI Events ---
    SHOW_MODAL: 'SHOW_MODAL', // モーダル表示を要求
    HIDE_MODAL: 'HIDE_MODAL', // モーダル非表示を要求
};
