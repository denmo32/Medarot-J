/**
 * @file ゲームイベント定義
 * システム間の通信に使用されるイベントを定義します。
 * すべてのイベントは、ペイロード構造と使用方法が明確にドキュメント化されています。
 */

/**
 * @enum {Object} GameEvents
 * @description ゲーム内で発生する全イベントを定義します。
 * 各イベントの詳細な仕様は、以下にコメントで記載されています。
 */
export const GameEvents = {
    // --- ゲームフローイベント ---
    /**
     * 開始確認モーダルで「はい」が押された
     * @event GAME_START_CONFIRMED
     * @type {string}
     * @payload {}
     */
    GAME_START_CONFIRMED: 'GAME_START_CONFIRMED',
    
    /**
     * リセットボタンがクリックされた
     * @event RESET_BUTTON_CLICKED
     * @type {string}
     * @payload {}
     */
    RESET_BUTTON_CLICKED: 'RESET_BUTTON_CLICKED',
    
    /**
     * ゲームのリセット処理が開始される直前
     * @event GAME_WILL_RESET
     * @type {string}
     * @payload {}
     */
    GAME_WILL_RESET: 'GAME_WILL_RESET',
    
    /**
     * 「ロボトルファイト！」がクリックされた
     * @event BATTLE_START_CONFIRMED
     * @type {string}
     * @payload {}
     */
    BATTLE_START_CONFIRMED: 'BATTLE_START_CONFIRMED',

    /**
     * ★新規: 戦闘開始アニメーションの表示を要求
     * @event SHOW_BATTLE_START_ANIMATION
     * @type {string}
     * @payload {}
     */
    SHOW_BATTLE_START_ANIMATION: 'SHOW_BATTLE_START_ANIMATION',

    /**
     * ★新規: 戦闘開始アニメーションの完了を通知
     * @event BATTLE_ANIMATION_COMPLETED
     * @type {string}
     * @payload {}
     */
    BATTLE_ANIMATION_COMPLETED: 'BATTLE_ANIMATION_COMPLETED',
    
    /**
     * UIによるゲームの一時停止イベント
     * @event GAME_PAUSED
     * @type {string}
     * @payload {}
     */
    GAME_PAUSED: 'GAME_PAUSED',
    
    /**
     * UIによるゲームの再開イベント
     * @event GAME_RESUMED
     * @type {string}
     * @payload {}
     */
    GAME_RESUMED: 'GAME_RESUMED',

    // --- プレイヤー入力 & AIイベント ---
    /**
     * プレイヤーの行動選択が必要になった
     * @event PLAYER_INPUT_REQUIRED
     * @type {string}
     * @payload {entityId: number} - 行動選択が必要なエンティティID
     */
    PLAYER_INPUT_REQUIRED: 'PLAYER_INPUT_REQUIRED',
    
    /**
     * プレイヤーが行動パーツを選択した
     * @event PART_SELECTED
     * @type {string}
     * @payload {entityId: number, partKey: string} - エンティティIDと選択されたパーツキー
     */
    PART_SELECTED: 'PART_SELECTED',
    
    /**
     * AIの行動選択が必要になった
     * @event AI_ACTION_REQUIRED
     * @type {string}
     * @payload {entityId: number} - 行動選択が必要なAIエンティティID
     */
    AI_ACTION_REQUIRED: 'AI_ACTION_REQUIRED',
    
    /**
     * プレイヤーまたはAIが行動を決定した
     * @event ACTION_SELECTED
     * @type {string}
     * @payload {entityId: number, action: Object} - エンティティIDと選択された行動情報
     */
    ACTION_SELECTED: 'ACTION_SELECTED',

    // --- 行動実行イベント ---
    /**
     * 行動実行アニメーションの開始を要求
     * @event EXECUTION_ANIMATION_REQUESTED
     * @type {string}
     * @payload {entityId: number} - アニメーションを実行するエンティティID
     */
    EXECUTION_ANIMATION_REQUESTED: 'EXECUTION_ANIMATION_REQUESTED',
    
    /**
     * 行動実行アニメーションの完了を通知
     * @event EXECUTION_ANIMATION_COMPLETED
     * @type {string}
     * @payload {entityId: number} - アニメーションが完了したエンティティID
     */
    EXECUTION_ANIMATION_COMPLETED: 'EXECUTION_ANIMATION_COMPLETED',
    
    /**
     * 実際のアニメーション実行を要求
     * @event EXECUTE_ATTACK_ANIMATION
     * @type {string}
     * @payload {attackerId: number, targetId: number} - 攻撃者とターゲットのエンティティID
     */
    EXECUTE_ATTACK_ANIMATION: 'EXECUTE_ATTACK_ANIMATION',
    
    /**
     * 攻撃宣言モーダルのOKが押された
     * @event ATTACK_DECLARATION_CONFIRMED
     * @type {string}
     * @payload {entityId: number, damage: number, resultMessage: string, targetId: number, targetPartKey: string} - 攻撃者ID、ダメージ、結果メッセージ、ターゲットIDとパーツキー
     */
    ATTACK_DECLARATION_CONFIRMED: 'ATTACK_DECLARATION_CONFIRMED',
    
    /**
     * 行動が実行され、ダメージなどが計算された
     * @event ACTION_EXECUTED
     * @type {string}
     * @payload {attackerId: number, targetId: number, targetPartKey: string, damage: number, isPartBroken: boolean, isPlayerBroken: boolean} - 攻撃情報と結果
     */
    ACTION_EXECUTED: 'ACTION_EXECUTED',
    
    /**
     * 攻撃シーケンス全体が完了した
     * @event ATTACK_SEQUENCE_COMPLETED
     * @type {string}
     * @payload {entityId: number} - 攻撃シーケンスが完了したエンティティID
     */
    ATTACK_SEQUENCE_COMPLETED: 'ATTACK_SEQUENCE_COMPLETED',

    // --- 状態 & ターン管理イベント ---
    /**
     * 行動可能になったユニットがターンキューへの追加を要求する
     * @event ACTION_QUEUE_REQUEST
     * @type {string}
     * @payload {entityId: number} - ターンキューに追加を要求するエンティティID
     */
    ACTION_QUEUE_REQUEST: 'ACTION_QUEUE_REQUEST',
    
    /**
     * 無効なアクションを選択した等の理由で、ターンキューの先頭に再挿入を要求する
     * @event ACTION_REQUEUE_REQUEST
     * @type {string}
     * @payload {entityId: number} - ターンキューに再挿入を要求するエンティティID
     */
    ACTION_REQUEUE_REQUEST: 'ACTION_REQUEUE_REQUEST',
    
    /**
     * パーツが破壊された
     * @event PART_BROKEN
     * @type {string}
     * @payload {entityId: number, partKey: string} - パーツが破壊されたエンティティIDとパーツキー
     */
    PART_BROKEN: 'PART_BROKEN',
    
    /**
     * プレイヤー（頭部）が破壊された
     * @event PLAYER_BROKEN
     * @type {string}
     * @payload {entityId: number, teamId: string} - 破壊されたプレイヤーのエンティティIDとチームID
     */
    PLAYER_BROKEN: 'PLAYER_BROKEN',
    
    /**
     * ゲームが終了した
     * @event GAME_OVER
     * @type {string}
     * @payload {winningTeam: string} - 勝利したチームID
     */
    GAME_OVER: 'GAME_OVER',

    // --- UIイベント ---
    /**
     * モーダル表示を要求
     * @event SHOW_MODAL
     * @type {string}
     * @payload {type: string, data: Object, immediate: boolean} - モーダルタイプ、データ、即時表示フラグ
     */
    SHOW_MODAL: 'SHOW_MODAL',
    
    /**
     * モーダル非表示を要求
     * @event HIDE_MODAL
     * @type {string}
     * @payload {}
     */
    HIDE_MODAL: 'HIDE_MODAL',
    
    /**
     * モーダルが閉じられたことを通知
     * @event MODAL_CLOSED
     * @type {string}
     * @payload {}
     */
    MODAL_CLOSED: 'MODAL_CLOSED',
    
    /**
     * UIの初期構築を要求
     * @event SETUP_UI_REQUESTED
     * @type {string}
     * @payload {}
     */
    SETUP_UI_REQUESTED: 'SETUP_UI_REQUESTED',
};