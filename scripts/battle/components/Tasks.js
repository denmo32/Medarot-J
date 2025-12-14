/**
 * @file Tasks.js
 * @description 演出シーケンス制御用のタスクコンポーネント定義。
 * これらがエンティティに付与されている間、TaskSystemはシーケンスの進行を待機する。
 */

/**
 * 待機タスク
 */
export class WaitTask {
    constructor(duration) {
        this.duration = duration;
        this.elapsed = 0;
    }
}

/**
 * 移動タスク
 * MovementSystem等が処理することを想定
 */
export class MoveTask {
    constructor(targetX, targetY, duration = 300) {
        this.targetX = targetX;
        this.targetY = targetY;
        this.duration = duration;
        this.elapsed = 0;
        this.startX = null;
        this.startY = null;
    }
}

/**
 * アニメーション再生タスク
 * AnimationSystemが処理
 */
export class AnimateTask {
    constructor(animationType, targetId) {
        this.animationType = animationType;
        this.targetId = targetId;
        // durationなどはAnimationSystem側で管理、またはここに追加
    }
}

/**
 * 汎用イベント発行タスク (瞬時完了)
 */
export class EventTask {
    constructor(eventName, detail) {
        this.eventName = eventName;
        this.detail = detail;
    }
}

/**
 * ダイアログ表示タスク
 * VisualDirectorSystemが処理
 */
export class DialogTask {
    constructor(text, options) {
        this.text = text;
        this.options = options;
        this.isDisplayed = false;
        // モーダルIDを保持し、閉じるのを待つ
        this.taskId = Math.random().toString(36).substr(2, 9); 
    }
}

/**
 * VFX再生タスク (瞬時完了または完了待ち)
 */
export class VfxTask {
    constructor(effectName, position) {
        this.effectName = effectName;
        this.position = position;
    }
}

/**
 * カメラ操作タスク
 */
export class CameraTask {
    constructor(action, params) {
        this.action = action;
        this.params = params;
    }
}

/**
 * UIアニメーションタスク
 */
export class UiAnimationTask {
    constructor(targetType, data) {
        this.targetType = targetType;
        this.data = data;
    }
}

/**
 * 視覚効果適用タスク
 */
export class ApplyVisualEffectTask {
    constructor(targetEntityId, className) {
        this.targetEntityId = targetEntityId;
        this.className = className;
    }
}

/**
 * カスタム関数実行タスク (瞬時完了)
 */
export class CustomTask {
    constructor(executeFn) {
        this.executeFn = executeFn;
    }
}