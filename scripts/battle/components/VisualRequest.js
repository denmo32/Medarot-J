/**
 * @file VisualRequest.js
 * @description 演出要求を表すコンポーネント群。
 * System間での演出リクエストの受け渡しに使用し、イベントバスへの依存を減らす。
 */

/**
 * アニメーション再生要求
 */
export class AnimationRequest {
    /**
     * @param {string} type - アニメーションタイプ ('attack', 'support', etc.)
     * @param {number|null} targetId - 対象エンティティID（攻撃相手など）
     * @param {object} options - その他のオプション
     */
    constructor(type, targetId = null, options = {}) {
        this.type = type;
        this.targetId = targetId;
        this.options = options;
    }
}

/**
 * VFX再生要求
 */
export class VfxRequest {
    /**
     * @param {string} effectName - エフェクト名
     * @param {object} position - {x, y}
     * @param {object} options
     */
    constructor(effectName, position = null, options = {}) {
        this.effectName = effectName;
        this.position = position;
        this.options = options;
    }
}

/**
 * ダイアログ（メッセージ）表示要求
 */
export class DialogRequest {
    /**
     * @param {string} text - 表示テキスト
     * @param {object} options - modalTypeなど
     */
    constructor(text, options = {}) {
        this.text = text;
        this.options = options;
    }
}

/**
 * UIアニメーション要求
 */
export class UiAnimationRequest {
    /**
     * @param {string} targetType - 'HP_BAR' など
     * @param {object} data - アニメーションデータ
     */
    constructor(targetType, data) {
        this.targetType = targetType;
        this.data = data;
    }
}

/**
 * カメラ操作要求
 */
export class CameraRequest {
    /**
     * @param {string} action - 'shake', 'zoom' など
     * @param {object} params
     */
    constructor(action, params = {}) {
        this.action = action;
        this.params = params;
    }
}