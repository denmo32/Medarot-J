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
    GAME_WILL_RESET: 'GAME_WILL_RESET',           // ★追加: ゲームのリセット処理が開始される直前
    BATTLE_START_CONFIRMED: 'BATTLE_START_CONFIRMED', // 「ロボトルファイト！」がクリックされた
    // ★新規: UIによるゲームの一時停止/再開イベント
    GAME_PAUSED: 'GAME_PAUSED',
    GAME_RESUMED: 'GAME_RESUMED',

    // --- Player Input & AI Events ---
    PLAYER_INPUT_REQUIRED: 'PLAYER_INPUT_REQUIRED', // プレイヤーの行動選択が必要になった
    PART_SELECTED: 'PART_SELECTED',                 // ★追加: プレイヤーが行動パーツを選択した
    AI_ACTION_REQUIRED: 'AI_ACTION_REQUIRED',       // AIの行動選択が必要になった
    ACTION_SELECTED: 'ACTION_SELECTED',             // プレイヤーまたはAIが行動を決定した

    // --- Action Execution Events ---
    EXECUTION_ANIMATION_REQUESTED: 'EXECUTION_ANIMATION_REQUESTED', // ★追加: 行動実行アニメーションの開始を要求
    EXECUTION_ANIMATION_COMPLETED: 'EXECUTION_ANIMATION_COMPLETED', // ★追加: 行動実行アニメーションの完了を通知
    ATTACK_DECLARATION_CONFIRMED: 'ATTACK_DECLARATION_CONFIRMED', // ★追加: 攻撃宣言モーダルのOKが押された
    ACTION_EXECUTION_CONFIRMED: 'ACTION_EXECUTION_CONFIRMED', // 攻撃モーダルのOKが押された
    ACTION_EXECUTED: 'ACTION_EXECUTED',                       // 行動が実行され、ダメージなどが計算された

    // --- State & Turn Management Events ---
    // ★追加: 行動可能になったユニットがターンキューへの追加を要求する
    ACTION_QUEUE_REQUEST: 'ACTION_QUEUE_REQUEST',
    // ★追加: 無効なアクションを選択した等の理由で、ターンキューの先頭に再挿入を要求する
    ACTION_REQUEUE_REQUEST: 'ACTION_REQUEUE_REQUEST',
    PART_BROKEN: 'PART_BROKEN',         // パーツが破壊された
    PLAYER_BROKEN: 'PLAYER_BROKEN',     // プレイヤー（頭部）が破壊された
    GAME_OVER: 'GAME_OVER',             // ゲームが終了した

    // --- UI Events ---
    SHOW_MODAL: 'SHOW_MODAL', // モーダル表示を要求
    HIDE_MODAL: 'HIDE_MODAL', // モーダル非表示を要求
    SETUP_UI_REQUESTED: 'SETUP_UI_REQUESTED', // ★追加: UIの初期構築を要求
};