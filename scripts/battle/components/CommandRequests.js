/**
 * @file CommandRequests.js
 * @description システムに状態変更を要求するためのデータコンポーネント群。
 */

// --- 状態遷移系 ---

/** 汎用的な状態遷移を要求 */
export class TransitionStateRequest {
    constructor(targetId, newState) {
        this.targetId = targetId;
        this.newState = newState;
    }
}

/** チャージ/クールダウン状態へのリセットを要求 */
export class ResetToCooldownRequest {
    constructor(targetId, options = {}) {
        this.targetId = targetId;
        this.options = options;
    }
}

/** ゲージ満タン時の処理を要求 */
export class HandleGaugeFullRequest {
    constructor(targetId) {
        this.targetId = targetId;
    }
}

/** プレイヤーの機能停止状態への遷移を要求 */
export class SetPlayerBrokenRequest {
    constructor(targetId) {
        this.targetId = targetId;
    }
}

/** アクションラインへのスナップを要求 */
export class SnapToActionLineRequest {
    constructor(targetId) {
        this.targetId = targetId;
    }
}

/** クールダウンへの遷移を要求 (アクション実行後) */
export class TransitionToCooldownRequest {
    constructor(targetId) {
        this.targetId = targetId;
    }
}


// --- コンポーネント更新系 ---

/** 特定コンポーネントのデータを更新 */
export class UpdateComponentRequest {
    constructor(targetId, componentType, updates) {
        this.targetId = targetId;
        this.componentType = componentType;
        this.updates = updates;
    }
}

/** カスタムロジックによるコンポーネントの更新 */
export class CustomUpdateComponentRequest {
    constructor(targetId, componentType, customHandler) {
        this.targetId = targetId;
        this.componentType = componentType;
        this.customHandler = customHandler;
    }
}