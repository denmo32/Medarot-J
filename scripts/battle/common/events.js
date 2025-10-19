﻿﻿﻿﻿/**
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
     * 戦闘開始がキャンセルされた
     * @event BATTLE_START_CANCELLED
     * @type {string}
     * @payload {}
     */
    BATTLE_START_CANCELLED: 'BATTLE_START_CANCELLED',

    /**
     * 戦闘開始アニメーションの表示を要求
     * @event SHOW_BATTLE_START_ANIMATION
     * @type {string}
     * @payload {}
     */
    SHOW_BATTLE_START_ANIMATION: 'SHOW_BATTLE_START_ANIMATION',

    /**
     * 戦闘開始アニメーションの完了を通知
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

	/**
     * ターゲティング戦略実行結果イベント
	 * @event STRATEGY_EXECUTED
	 * @type {string}
     * @payload {{ strategy: string, attackerId: number, target: { targetId: number, targetPartKey: string } }}
	 */
	STRATEGY_EXECUTED: 'STRATEGY_EXECUTED',
	
	// --- プレイヤー入力 & AIイベント ---
    /**
     * プレイヤーの行動選択が必要になった
     * @event PLAYER_INPUT_REQUIRED
     * @type {string}
     * @payload {{ entityId: number }} - 行動選択が必要なエンティティID
     */
    PLAYER_INPUT_REQUIRED: 'PLAYER_INPUT_REQUIRED',
    
    /**
     * プレイヤーが行動パーツを選択した
     * @event PART_SELECTED
     * @type {string}
     * @payload {{ entityId: number, partKey: string, targetId: number | null, targetPartKey: string | null }}
     */
    PART_SELECTED: 'PART_SELECTED',
    
    /**
     * AIの行動選択が必要になった
     * @event AI_ACTION_REQUIRED
     * @type {string}
     * @payload {{ entityId: number }} - 行動選択が必要なAIエンティティID
     */
    AI_ACTION_REQUIRED: 'AI_ACTION_REQUIRED',
    
    /**
     * プレイヤーまたはAIが行動を決定した
     * @event ACTION_SELECTED
     * @type {string}
     * @payload {{ entityId: number, partKey: string, targetId: number | null, targetPartKey: string | null }}
     */
    ACTION_SELECTED: 'ACTION_SELECTED',

    // --- 行動実行イベント ---
    /**
     * 行動が宣言され、メッセージ生成が必要になったことを通知する
     * MessageSystemが購読し、攻撃宣言モーダルのメッセージを生成する。
     * @event ACTION_DECLARED
     * @type {string}
     * @payload {{ attackerId: number, targetId: number, attackingPart: object, isSupport: boolean, guardianInfo: object | null }}
     */
    ACTION_DECLARED: 'ACTION_DECLARED',

    /**
     * 行動実行アニメーションの開始を要求
     * @event EXECUTION_ANIMATION_REQUESTED
     * @type {string}
     * @payload {{ attackerId: number, targetId: number }}
     */
    EXECUTION_ANIMATION_REQUESTED: 'EXECUTION_ANIMATION_REQUESTED',
    
    /**
     * 行動実行アニメーションの完了を通知
     * @event EXECUTION_ANIMATION_COMPLETED
     * @type {string}
     * @payload {{ entityId: number }} - アニメーションが完了したエンティティID
     */
    EXECUTION_ANIMATION_COMPLETED: 'EXECUTION_ANIMATION_COMPLETED',
    
    /**
     * 実際のアニメーション実行を要求
     * @event EXECUTE_ATTACK_ANIMATION
     * @type {string}
     * @payload {{ attackerId: number, targetId: number }}
     */
    EXECUTE_ATTACK_ANIMATION: 'EXECUTE_ATTACK_ANIMATION',
    
    /**
     * 攻撃宣言モーダルのOKが押された
     * @event ATTACK_DECLARATION_CONFIRMED
     * @type {string}
     * @payload {{ attackerId: number, targetId: number, resolvedEffects: Array<object>, isEvaded: boolean, isSupport: boolean, guardianInfo: object | null }}
     */
    ATTACK_DECLARATION_CONFIRMED: 'ATTACK_DECLARATION_CONFIRMED',
    
    /**
     * ActionSystemがアクション効果の計算を完了したことを通知する内部イベント。
     * EffectApplicatorSystem, StateSystem, HistorySystemがこれを購読し、それぞれの責務を遂行する。
     * これにより、効果の「計算」と「適用」が明確に分離される。
     * @event EFFECTS_RESOLVED
     * @type {string}
     * @payload {{ attackerId: number, resolvedEffects: Array<object>, isEvaded: boolean, isSupport: boolean, guardianInfo: object | null }}
     */
    EFFECTS_RESOLVED: 'EFFECTS_RESOLVED',

    /**
     * 行動が実行され、ダメージなどが計算された
     * @event ACTION_EXECUTED
     * @type {string}
     * @payload {{ attackerId: number, targetId: number, appliedEffects: Array<object>, isEvaded: boolean, isSupport: boolean, guardianInfo: object | null }}
     */
    ACTION_EXECUTED: 'ACTION_EXECUTED',
    
    /**
     * 攻撃シーケンス全体が完了した
     * @event ATTACK_SEQUENCE_COMPLETED
     * @type {string}
     * @payload {{ entityId: number }} - 攻撃シーケンスが完了したエンティティID
     */
    ATTACK_SEQUENCE_COMPLETED: 'ATTACK_SEQUENCE_COMPLETED',

    // --- 状態 & ターン管理イベント ---
    /**
     * ゲージが満タンになった
     * @event GAUGE_FULL
     * @type {string}
     * @payload {{ entityId: number }} - ゲージが満タンになったエンティティID
     */
    GAUGE_FULL: 'GAUGE_FULL',

    /**
     * 行動可能になったユニットがターンキューへの追加を要求する
     * @event ACTION_QUEUE_REQUEST
     * @type {string}
     * @payload {{ entityId: number }} - ターンキューに追加を要求するエンティティID
     */
    ACTION_QUEUE_REQUEST: 'ACTION_QUEUE_REQUEST',
    
    /**
     * 無効なアクションを選択した等の理由で、ターンキューの先頭に再挿入を要求する
     * @event ACTION_REQUEUE_REQUEST
     * @type {string}
     * @payload {{ entityId: number }} - ターンキューに再挿入を要求するエンティティID
     */
    ACTION_REQUEUE_REQUEST: 'ACTION_REQUEUE_REQUEST',

    /**
     * 予約されていた行動がキャンセルされたことを通知する
     * MessageSystemが購読し、キャンセル理由に応じたメッセージを生成する。
     * @event ACTION_CANCELLED
     * @type {string}
     * @payload {{ entityId: number, reason: 'PART_BROKEN' | 'TARGET_LOST' }}
     */
    ACTION_CANCELLED: 'ACTION_CANCELLED',
    
    /**
     * パーツが破壊された
     * @event PART_BROKEN
     * @type {string}
     * @payload {{ entityId: number, partKey: string }} - パーツが破壊されたエンティティIDとパーツキー
     */
    PART_BROKEN: 'PART_BROKEN',
    
    /**
     * プレイヤー（頭部）が破壊された
     * @event PLAYER_BROKEN
     * @type {string}
     * @payload {{ entityId: number, teamId: string }} - 破壊されたプレイヤーのエンティティIDとチームID
     */
    PLAYER_BROKEN: 'PLAYER_BROKEN',
    
    /**
     * ゲームが終了した
     * @event GAME_OVER
     * @type {string}
     * @payload {{ winningTeam: string }} - 勝利したチームID
     */
    GAME_OVER: 'GAME_OVER',
    
    /**
     * HPが更新された（ダメージまたは回復）
     * EffectApplicatorSystemが発行し、UISystemやActionPanelSystemが購読する。
     * @event HP_UPDATED
     * @type {string}
     * @payload {{ entityId: number, partKey: string, newHp: number, maxHp: number, change: number, isHeal: boolean }}
     */
    HP_UPDATED: 'HP_UPDATED',
    
    /**
     * 効果の持続時間や回数がなくなり、効果が失われた
     * EffectSystemやEffectApplicatorSystemが発行し、StateSystemが購読する。
     * @event EFFECT_EXPIRED
     * @type {string}
     * @payload {{ entityId: number, effect: object }}
     */
    EFFECT_EXPIRED: 'EFFECT_EXPIRED',

    /**
     * ガードパーツが破壊され、ガード状態が解除されたことを通知する
     * MessageSystemが購読し、メッセージを生成する。
     * @event GUARD_BROKEN
     * @type {string}
     * @payload {{ entityId: number }}
     */
    GUARD_BROKEN: 'GUARD_BROKEN',

    // --- UIイベント ---
    /**
     * モーダル表示を要求
     * @event SHOW_MODAL
     * @type {string}
     * @payload {{ type: string, data: Object, immediate?: boolean, priority?: string, messageSequence?: Array<Object> }} - モーダルタイプ、データ、即時表示フラグなど。messageSequenceで複数メッセージの順次表示も可能。
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
     * @payload {{ modalType: string }} - 閉じられたモーダルのタイプ
     */
    MODAL_CLOSED: 'MODAL_CLOSED',
    
    /**
     * UIの初期構築を要求
     * @event SETUP_UI_REQUESTED
     * @type {string}
     * @payload {}
     */
    SETUP_UI_REQUESTED: 'SETUP_UI_REQUESTED',
    
    /**
     * HPバーのアニメーション再生を要求
     * @event HP_BAR_ANIMATION_REQUESTED
     * @type {string}
     * @payload {{ effects: Array<object> }} - アニメーション対象の効果リスト
     */
    HP_BAR_ANIMATION_REQUESTED: 'HP_BAR_ANIMATION_REQUESTED',

    /**
     * HPバーのアニメーション完了を通知
     * @event HP_BAR_ANIMATION_COMPLETED
     * @type {string}
     * @payload {}
     */
    HP_BAR_ANIMATION_COMPLETED: 'HP_BAR_ANIMATION_COMPLETED',
};