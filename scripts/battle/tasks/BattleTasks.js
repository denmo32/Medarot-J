/**
 * @file BattleTasks.js
 * @description バトルシーンで使用するタスク（コマンド）の定義
 * 演出系のタスクを拡充し、宣言的に記述できるようにする。
 */

export const TaskType = {
    // 基本制御
    WAIT: 'WAIT',
    EVENT: 'EVENT',
    CUSTOM: 'CUSTOM',
    
    // ロジック制御
    APPLY_STATE: 'APPLY_STATE',
    
    // 演出・UI制御
    MOVE: 'MOVE',
    ANIMATE: 'ANIMATE',      // ユニットのアニメーション (攻撃モーションなど)
    VFX: 'VFX',              // 視覚効果 (パーティクル、ヒットエフェクト)
    CAMERA: 'CAMERA',        // カメラ制御 (ズーム、シェイク)
    DIALOG: 'DIALOG',        // メッセージウィンドウ表示 (旧 MESSAGE)
    UI_ANIMATION: 'UI_ANIMATION' // HPバーなどのUIアニメーション
};

/**
 * 指定時間待機するタスク
 */
export const createWaitTask = (durationMs) => ({
    type: TaskType.WAIT,
    duration: durationMs
});

/**
 * エンティティを指定位置へ移動させるタスク
 */
export const createMoveTask = (entityId, targetX, targetY, durationMs = 300) => ({
    type: TaskType.MOVE,
    entityId,
    targetX,
    targetY,
    duration: durationMs
});

/**
 * ユニットのアニメーションを再生するタスク
 * @param {number} attackerId 
 * @param {number} targetId 
 * @param {string} animationType 'attack', 'damage', 'guard' etc.
 */
export const createAnimateTask = (attackerId, targetId, animationType = 'attack') => ({
    type: TaskType.ANIMATE,
    attackerId,
    targetId,
    animationType
});

/**
 * 汎用的な視覚効果(VFX)を再生するタスク
 * @param {string} effectName 'hit_spark', 'beam', 'explosion'
 * @param {object} position { x, y } or { targetId }
 */
export const createVfxTask = (effectName, position) => ({
    type: TaskType.VFX,
    effectName,
    position
});

/**
 * カメラを制御するタスク
 * @param {string} action 'shake', 'zoom', 'reset'
 * @param {object} params
 */
export const createCameraTask = (action, params = {}) => ({
    type: TaskType.CAMERA,
    action,
    params
});

/**
 * ダイアログ（メッセージ）を表示するタスク
 * 旧 createMessageTask の後継。シーケンス制御は含まない純粋な表示のみ。
 * @param {string} text 表示テキスト
 * @param {object} options { modalType, speakerName, autoClose }
 */
export const createDialogTask = (text, options = {}) => ({
    type: TaskType.DIALOG,
    text,
    options
});

/**
 * UI要素のアニメーションを実行するタスク
 * @param {string} targetType 'HP_BAR', 'GAUGE'
 * @param {object} data アニメーションに必要なデータ (oldVal, newVal, targetId)
 */
export const createUiAnimationTask = (targetType, data) => ({
    type: TaskType.UI_ANIMATION,
    targetType,
    data
});

/**
 * 状態変化を適用するタスク（ロジック用）
 */
export const createApplyStateTask = (applyFn) => ({
    type: TaskType.APPLY_STATE,
    applyFn
});

/**
 * 任意のイベントを発行するタスク
 */
export const createEventTask = (eventName, detail) => ({
    type: TaskType.EVENT,
    eventName,
    detail
});

/**
 * 任意の非同期処理を実行するタスク
 */
export const createCustomTask = (asyncFn) => ({
    type: TaskType.CUSTOM,
    execute: asyncFn
});