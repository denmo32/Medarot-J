/**
 * @file BattleTasks.js
 * @description バトルシーンで使用するタスク（コマンド）の定義
 */

export const TaskType = {
    WAIT: 'WAIT',
    MOVE: 'MOVE',
    ANIMATE: 'ANIMATE',
    EFFECT: 'EFFECT',
    MESSAGE: 'MESSAGE',
    APPLY_STATE: 'APPLY_STATE',
    EVENT: 'EVENT',
    CUSTOM: 'CUSTOM'
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
 * @param {number} entityId 
 * @param {number} targetX Ratio (0.0 - 1.0)
 * @param {number} targetY Percent
 * @param {number} durationMs 
 */
export const createMoveTask = (entityId, targetX, targetY, durationMs = 300) => ({
    type: TaskType.MOVE,
    entityId,
    targetX,
    targetY,
    duration: durationMs
});

/**
 * 攻撃アニメーション等を再生するタスク
 * @param {number} attackerId 
 * @param {number} targetId 
 * @param {string} animationType 'attack', 'cast', etc.
 */
export const createAnimateTask = (attackerId, targetId, animationType = 'attack') => ({
    type: TaskType.ANIMATE,
    attackerId,
    targetId,
    animationType
});

/**
 * メッセージ（モーダル）を表示するタスク
 * @param {ModalType} modalType 
 * @param {object} data 
 * @param {Array} messageSequence 
 */
export const createMessageTask = (modalType, data, messageSequence) => ({
    type: TaskType.MESSAGE,
    modalType,
    data,
    messageSequence
});

/**
 * 状態変化を適用するタスク（HP減少、エフェクト適用など）
 * @param {Function} applyFn (world) => void
 */
export const createApplyStateTask = (applyFn) => ({
    type: TaskType.APPLY_STATE,
    applyFn
});

/**
 * 任意のイベントを発行するタスク
 * @param {string} eventName 
 * @param {object} detail 
 */
export const createEventTask = (eventName, detail) => ({
    type: TaskType.EVENT,
    eventName,
    detail
});

/**
 * 任意の非同期処理を実行するタスク
 * @param {Function} asyncFn (world) => Promise<void>
 */
export const createCustomTask = (asyncFn) => ({
    type: TaskType.CUSTOM,
    execute: asyncFn
});