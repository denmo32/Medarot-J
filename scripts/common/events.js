/**
 * @file ゲームイベント定義
 * システム間の通信に使用されるイベントを定義します。
 * ペイロード構造と使用方法を明確にドキュメント化します。
 * (旧 scripts/battle/common/events.js から移動)
 */

/**
 * @enum {Object} GameEvents
 * @description ゲーム内で発生する全イベントを定義します。
 */
export const GameEvents = {
    // --- ゲームフローイベント ---
    /**
     * 開始確認モーダルで「はい」が押された
     * @event GAME_START_CONFIRMED
     */
    GAME_START_CONFIRMED: 'GAME_START_CONFIRMED',
    
    /**
     * リセットボタンがクリックされた
     * @event RESET_BUTTON_CLICKED
     */
    RESET_BUTTON_CLICKED: 'RESET_BUTTON_CLICKED',
    
    /**
     * ゲームのリセット処理が開始される直前
     * @event GAME_WILL_RESET
     */
    GAME_WILL_RESET: 'GAME_WILL_RESET',

    /**
     * バトルシーンの初期化が完了したことを通知
     * @event BATTLE_INITIALIZED
     */
    BATTLE_INITIALIZED: 'BATTLE_INITIALIZED',

    /**
     * 戦闘開始がキャンセルされた
     * @event BATTLE_START_CANCELLED
     */
    BATTLE_START_CANCELLED: 'BATTLE_START_CANCELLED',

    /**
     * 戦闘開始モーダルで「はい」が押されたイベント
     * @event BATTLE_START_CONFIRMED
     */
    BATTLE_START_CONFIRMED: 'BATTLE_START_CONFIRMED',

    /**
     * 戦闘開始アニメーションの表示を要求
     * @event SHOW_BATTLE_START_ANIMATION
     */
    SHOW_BATTLE_START_ANIMATION: 'SHOW_BATTLE_START_ANIMATION',
    
    /**
     * UIによるゲームの一時停止イベント
     * @event GAME_PAUSED
     */
    GAME_PAUSED: 'GAME_PAUSED',
    
    /**
     * UIによるゲームの再開イベント
     * @event GAME_RESUMED
     */
    GAME_RESUMED: 'GAME_RESUMED',

	/**
     * ターゲティング戦略実行結果イベント
	 * @event STRATEGY_EXECUTED
	 */
	STRATEGY_EXECUTED: 'STRATEGY_EXECUTED',
	
	// --- プレイヤー入力 & AIイベント ---
    /**
     * プレイヤーの行動選択が必要になった
     * @event PLAYER_INPUT_REQUIRED
     * @payload {{ entityId: number }}
     */
    PLAYER_INPUT_REQUIRED: 'PLAYER_INPUT_REQUIRED',
    
    /**
     * プレイヤーが行動パーツを選択した
     * @event PART_SELECTED
     * @payload {{ entityId: number, partKey: string, targetId: number | null, targetPartKey: string | null }}
     */
    PART_SELECTED: 'PART_SELECTED',
    
    /**
     * AIの行動選択が必要になった
     * @event AI_ACTION_REQUIRED
     * @payload {{ entityId: number }}
     */
    AI_ACTION_REQUIRED: 'AI_ACTION_REQUIRED',
    
    /**
     * プレイヤーまたはAIが行動を決定した
     * @event ACTION_SELECTED
     * @payload {{ entityId: number, partKey: string, targetId: number | null, targetPartKey: string | null }}
     */
    ACTION_SELECTED: 'ACTION_SELECTED',

    // --- BattleSequenceSystem 制御用イベント (新規・整理) ---

    /**
     * アクションシーケンスの開始要求 (ActionExecutionSystem -> BattleSequenceSystem)
     * @event REQUEST_ACTION_SEQUENCE_START
     * @payload {{ entityId: number, actionDetail: object }}
     */
    REQUEST_ACTION_SEQUENCE_START: 'REQUEST_ACTION_SEQUENCE_START',

    /**
     * アクション実行アニメーションの開始要求 (BattleSequenceSystem -> ActionExecutionSystem)
     * @event REQUEST_EXECUTION_ANIMATION
     * @payload {{ entityId: number }}
     */
    REQUEST_EXECUTION_ANIMATION: 'REQUEST_EXECUTION_ANIMATION',

    /**
     * 実際のアニメーション実行を要求 (ActionExecutionSystem -> ViewSystem)
     * @event EXECUTE_ATTACK_ANIMATION
     * @payload {{ attackerId: number, targetId: number }}
     */
    EXECUTE_ATTACK_ANIMATION: 'EXECUTE_ATTACK_ANIMATION',

    /**
     * アクション実行アニメーションの完了 (ViewSystem -> ActionExecutionSystem -> BattleSequenceSystem)
     * @event EXECUTION_ANIMATION_COMPLETED
     * @payload {{ entityId: number }}
     */
    EXECUTION_ANIMATION_COMPLETED: 'EXECUTION_ANIMATION_COMPLETED',

    /**
     * アクション結果の解決要求 (BattleSequenceSystem -> ActionResolutionSystem)
     * @event REQUEST_ACTION_RESOLUTION
     * @payload {{ entityId: number }}
     */
    REQUEST_ACTION_RESOLUTION: 'REQUEST_ACTION_RESOLUTION',

    /**
     * アクション解決完了 (ActionResolutionSystem -> BattleSequenceSystem)
     * @event ACTION_RESOLUTION_COMPLETED
     * @payload {{ resultData: object }}
     */
    ACTION_RESOLUTION_COMPLETED: 'ACTION_RESOLUTION_COMPLETED',

    /**
     * 結果表示要求 (BattleSequenceSystem -> MessageSystem)
     * @event REQUEST_RESULT_DISPLAY
     * @payload {{ resultData: object }}
     */
    REQUEST_RESULT_DISPLAY: 'REQUEST_RESULT_DISPLAY',

    /**
     * クールダウン移行要求 (BattleSequenceSystem -> CooldownSystem)
     * @event REQUEST_COOLDOWN_TRANSITION
     * @payload {{ entityId: number }}
     */
    REQUEST_COOLDOWN_TRANSITION: 'REQUEST_COOLDOWN_TRANSITION',

    /**
     * クールダウン移行完了 (CooldownSystem -> BattleSequenceSystem)
     * @event COOLDOWN_TRANSITION_COMPLETED
     * @payload {{ entityId: number }}
     */
    COOLDOWN_TRANSITION_COMPLETED: 'COOLDOWN_TRANSITION_COMPLETED',

    /**
     * アクションシーケンス全体の完了 (BattleSequenceSystem -> ActionExecutionSystem/Others)
     * @event ACTION_SEQUENCE_COMPLETED
     * @payload {{ entityId: number }}
     */
    ACTION_SEQUENCE_COMPLETED: 'ACTION_SEQUENCE_COMPLETED',

    // --- その他イベント ---

    /**
     * 戦闘シーケンス（宣言から結果まで）が解決されたことを通知する統合イベント。
     * 履歴記録などで使用。
     * @event COMBAT_SEQUENCE_RESOLVED
     */
    COMBAT_SEQUENCE_RESOLVED: 'COMBAT_SEQUENCE_RESOLVED',

    /**
     * 戦闘結果の表示が完了したことを通知するイベント。
     * @event COMBAT_RESOLUTION_DISPLAYED
     * @payload {{ attackerId: number }}
     */
    COMBAT_RESOLUTION_DISPLAYED: 'COMBAT_RESOLUTION_DISPLAYED',

    /**
     * 行動が完了し、クールダウンへ移行すべきことを通知するイベント。
     * (BattleSequenceSystem導入に伴い非推奨化または内部利用に限定)
     * @event ACTION_COMPLETED
     */
    ACTION_COMPLETED: 'ACTION_COMPLETED',
    
    /**
     * 攻撃宣言モーダルのOKが押された
     * @event ATTACK_DECLARATION_CONFIRMED
     */
    ATTACK_DECLARATION_CONFIRMED: 'ATTACK_DECLARATION_CONFIRMED',

    // --- 状態 & ターン管理イベント ---
    /**
     * 行動選択フェーズの完了を通知
     * @event ACTION_SELECTION_COMPLETED
     */
    ACTION_SELECTION_COMPLETED: 'ACTION_SELECTION_COMPLETED',
    
    /**
     * 行動実行フェーズの完了を通知
     * @event ACTION_EXECUTION_COMPLETED
     */
    ACTION_EXECUTION_COMPLETED: 'ACTION_EXECUTION_COMPLETED',
    
    /**
     * 行動解決フェーズの完了を通知
     * @event ACTION_RESOLUTION_COMPLETED
     */
    // ACTION_RESOLUTION_COMPLETED: 'ACTION_RESOLUTION_COMPLETED', // 上記で定義済み

    /**
     * 新しいターンが開始したことを通知
     * @event TURN_START
     */
    TURN_START: 'TURN_START',

    /**
     * ターンが終了したことを通知
     * @event TURN_END
     */
    TURN_END: 'TURN_END',
    
    /**
     * ゲージが満タンになった
     * @event GAUGE_FULL
     */
    GAUGE_FULL: 'GAUGE_FULL',

    /**
     * 行動可能になったユニットがターンキューへの追加を要求する
     * @event ACTION_QUEUE_REQUEST
     */
    ACTION_QUEUE_REQUEST: 'ACTION_QUEUE_REQUEST',
    
    /**
     * 無効なアクションを選択した等の理由で、ターンキューの先頭に再挿入を要求する
     * @event ACTION_REQUEUE_REQUEST
     */
    ACTION_REQUEUE_REQUEST: 'ACTION_REQUEUE_REQUEST',

    /**
     * 次に行動すべきアクターが決定したことを通知する
     * @event NEXT_ACTOR_DETERMINED
     */
    NEXT_ACTOR_DETERMINED: 'NEXT_ACTOR_DETERMINED',

    /**
     * 予約されていた行動がキャンセルされたことを通知する
     * @event ACTION_CANCELLED
     */
    ACTION_CANCELLED: 'ACTION_CANCELLED',
    
    /**
     * パーツが破壊された
     * @event PART_BROKEN
     */
    PART_BROKEN: 'PART_BROKEN',
    
    /**
     * プレイヤー（頭部）が破壊された
     * @event PLAYER_BROKEN
     */
    PLAYER_BROKEN: 'PLAYER_BROKEN',
    
    /**
     * ゲームが終了した
     * @event GAME_OVER
     */
    GAME_OVER: 'GAME_OVER',
    
    /**
     * HPが更新された（ダメージまたは回復）
     * @event HP_UPDATED
     */
    HP_UPDATED: 'HP_UPDATED',
    
    /**
     * 効果の持続時間や回数がなくなり、効果が失われた
     * @event EFFECT_EXPIRED
     */
    EFFECT_EXPIRED: 'EFFECT_EXPIRED',

    /**
     * ガードパーツが破壊され、ガード状態が解除されたことを通知する
     * @event GUARD_BROKEN
     */
    GUARD_BROKEN: 'GUARD_BROKEN',

    // --- UI & Sceneイベント ---
    /**
     * シーン遷移を要求する汎用イベント
     * @event SCENE_CHANGE_REQUESTED
     */
    SCENE_CHANGE_REQUESTED: 'SCENE_CHANGE_REQUESTED',

    /**
     * モーダル表示を要求
     * @event SHOW_MODAL
     */
    SHOW_MODAL: 'SHOW_MODAL',
    
    /**
     * モーダル非表示を要求
     * @event HIDE_MODAL
     */
    HIDE_MODAL: 'HIDE_MODAL',
    
    /**
     * モーダルが閉じられたことを通知
     * @event MODAL_CLOSED
     */
    MODAL_CLOSED: 'MODAL_CLOSED',
    
    /**
     * モーダルのメッセージシーケンスが完了したことを通知
     * @event MODAL_SEQUENCE_COMPLETED
     */
    MODAL_SEQUENCE_COMPLETED: 'MODAL_SEQUENCE_COMPLETED',
    
    /**
     * UIの初期構築を要求
     * @event SETUP_UI_REQUESTED
     */
    SETUP_UI_REQUESTED: 'SETUP_UI_REQUESTED',
    
    /**
     * HPバーのアニメーション再生を要求
     * @event HP_BAR_ANIMATION_REQUESTED
     */
    HP_BAR_ANIMATION_REQUESTED: 'HP_BAR_ANIMATION_REQUESTED',

    /**
     * HPバーのアニメーション完了を通知
     * @event HP_BAR_ANIMATION_COMPLETED
     */
    HP_BAR_ANIMATION_COMPLETED: 'HP_BAR_ANIMATION_COMPLETED',

    // --- カスタマイズ画面イベント ---
    /**
     * カスタマイズ画面で決定入力があった
     * @event CUST_CONFIRM_INPUT
     */
    CUST_CONFIRM_INPUT: 'CUST_CONFIRM_INPUT',

    /**
     * カスタマイズ画面でキャンセル入力があった
     * @event CUST_CANCEL_INPUT
     */
    CUST_CANCEL_INPUT: 'CUST_CANCEL_INPUT',

    /**
     * カスタマイズ画面でナビゲーション入力があった
     * @event CUST_NAVIGATE_INPUT
     */
    CUST_NAVIGATE_INPUT: 'CUST_NAVIGATE_INPUT',

    /**
     * パーツ装備が要求された
     * @event EQUIP_PART_REQUESTED
     */
    EQUIP_PART_REQUESTED: 'EQUIP_PART_REQUESTED',

    /**
     * メダル装備が要求された
     * @event EQUIP_MEDAL_REQUESTED
     */
    EQUIP_MEDAL_REQUESTED: 'EQUIP_MEDAL_REQUESTED',

    /**
     * パーツの装備が完了した
     * @event PART_EQUIPPED
     */
    PART_EQUIPPED: 'PART_EQUIPPED',

    /**
     * メダルの装備が完了した
     * @event MEDAL_EQUIPPED
     */
    MEDAL_EQUIPPED: 'MEDAL_EQUIPPED',

    /**
     * カスタマイズ画面の終了が要求された
     * @event CUSTOMIZE_EXIT_REQUESTED
     */
    CUSTOMIZE_EXIT_REQUESTED: 'CUSTOMIZE_EXIT_REQUESTED',
    
    /**
     * カスタマイズシーンへの遷移が要求された
     * @event CUSTOMIZE_SCENE_REQUESTED
     */
    CUSTOMIZE_SCENE_REQUESTED: 'CUSTOMIZE_SCENE_REQUESTED',

    // --- マップ画面イベント ---
    /**
     * インタラクションキーが押された
     * @event INTERACTION_KEY_PRESSED
     */
    INTERACTION_KEY_PRESSED: 'INTERACTION_KEY_PRESSED',

    /**
     * NPCとのインタラクションが要求された (UI表示など)
     * @event NPC_INTERACTION_REQUESTED
     */
    NPC_INTERACTION_REQUESTED: 'NPC_INTERACTION_REQUESTED',

    /**
     * NPCとのインタラクションが確定した (バトル開始など)
     * @event NPC_INTERACTED
     */
    NPC_INTERACTED: 'NPC_INTERACTED',

    /**
     * メニューの表示切り替えが要求された
     * @event MENU_TOGGLE_REQUESTED
     */
    MENU_TOGGLE_REQUESTED: 'MENU_TOGGLE_REQUESTED',

    /**
     * ゲームのセーブが要求された
     * @event GAME_SAVE_REQUESTED
     */
    GAME_SAVE_REQUESTED: 'GAME_SAVE_REQUESTED',

    /**
     * UIの状態が変更された (デバッグや状態管理用)
     * @event UI_STATE_CHANGED
     */
    UI_STATE_CHANGED: 'UI_STATE_CHANGED',
};