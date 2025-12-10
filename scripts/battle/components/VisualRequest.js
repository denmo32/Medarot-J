/**
 * @file VisualRequest.js
 * @description 演出要求を表すコンポーネント群。
 * 識別子(id)を追加し、厳密な管理を可能にする。
 */

export class AnimationRequest {
    constructor(type, targetId = null, options = {}) {
        this.type = type;
        this.targetId = targetId;
        this.options = options;
        this.id = Math.random().toString(36).substr(2, 9);
    }
}

export class VfxRequest {
    constructor(effectName, position = null, options = {}) {
        this.effectName = effectName;
        this.position = position;
        this.options = options;
        this.id = Math.random().toString(36).substr(2, 9);
    }
}

export class DialogRequest {
    constructor(text, options = {}) {
        this.text = text;
        this.options = options;
        this.id = Math.random().toString(36).substr(2, 9);
        this.isDisplayed = false;
    }
}

export class UiAnimationRequest {
    constructor(targetType, data) {
        this.targetType = targetType;
        this.data = data;
        this.id = Math.random().toString(36).substr(2, 9);
    }
}

export class CameraRequest {
    constructor(action, params = {}) {
        this.action = action;
        this.params = params;
        this.id = Math.random().toString(36).substr(2, 9);
    }
}