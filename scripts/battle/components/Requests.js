/**
 * @file Requests.js
 * @description ECSの処理フロー制御用のリクエスト/結果コンポーネント群。
 * イベントの代わりにこれらのコンポーネントを使用してシステム間でメッセージを伝達する。
 */

// --- システム間連携リクエスト ---

export class CombatRequest {
    constructor(attackerId) {
        this.attackerId = attackerId;
    }
}

export class CombatResult {
    constructor(data) {
        this.data = data;
    }
}

export class VisualSequenceRequest {
    constructor(context) {
        this.context = context;
    }
}

export class VisualSequenceResult {
    constructor(sequence) {
        this.sequence = sequence;
    }
}

export class VisualSequence {
    constructor(tasks) {
        this.tasks = tasks;
    }
}

export class AiActionRequest {
    constructor() {}
}

/**
 * アクションが選択されたことを通知するリクエスト
 * ActionSelectionSystem がこれを処理する
 */
export class ActionSelectedRequest {
    constructor(entityId, partKey, targetId, targetPartKey) {
        this.entityId = entityId;
        this.partKey = partKey;
        this.targetId = targetId;
        this.targetPartKey = targetPartKey;
    }
}

/**
 * アクション選択のやり直しを要求するリクエスト
 */
export class ActionRequeueRequest {
    constructor(entityId) {
        this.entityId = entityId;
    }
}

// --- UI/Input 関連インテント (意図) ---

/**
 * ユーザー入力の意図を表す一時コンポーネント
 * UIInputSystem が生成し、ModalSystem 等が消費する
 */
export class UIInputIntent {
    /**
     * @param {string} type - 'NAVIGATE', 'CONFIRM', 'CANCEL'
     * @param {object} [data] - { direction: 'up' } など
     */
    constructor(type, data = {}) {
        this.type = type; // 'NAVIGATE' | 'CONFIRM' | 'CANCEL'
        this.data = data;
    }
}

/**
 * モーダル表示リクエスト
 */
export class ModalRequest {
    constructor(type, data = {}, options = {}) {
        this.type = type;
        this.data = data;
        this.messageSequence = options.messageSequence || null;
        this.taskId = options.taskId || null;
        this.onComplete = options.onComplete || null;
        this.priority = options.priority || 'normal';
    }
}

/**
 * モーダルを閉じるリクエスト
 */
export class CloseModalRequest {
    constructor(modalType = null, taskId = null) {
        this.modalType = modalType;
        this.taskId = taskId;
    }
}

/**
 * UIの状態更新リクエスト（アニメーション完了通知など）
 */
export class UIStateUpdateRequest {
    constructor(type, data = {}) {
        this.type = type; // 'ANIMATION_COMPLETED' など
        this.data = data;
    }
}