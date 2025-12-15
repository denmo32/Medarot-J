/**
 * @file States.js
 * @description ECSにおける状態コンポーネント群。
 * システムの状態保持を排除するためのコンポーネントを追加。
 */

export class ModalState {
    constructor() {
        this.isOpen = false;
        this.type = null;
        this.data = {};
        this.messageSequence = null;
        this.taskId = null;
        this.onComplete = null;
        this.priority = 'normal';
        this.isNew = true;
        this.isCompleted = false;
    }
}

export class ActionState {
    constructor() {
        this.state = 'idle'; // 'idle', 'selected', 'processing', 'completed'
        this.entityId = null;
        this.partKey = null;
        this.targetId = null;
        this.targetPartKey = null;
    }
}

export class PlayerInputState {
    constructor() {
        this.isActive = false;
        this.entityId = null;
    }
}

export class ActionRequeueState {
    constructor() {
        this.isActive = false;
        this.entityId = null;
    }
}

export class AnimationState {
    constructor() {
        this.type = null; // 'HP_BAR', 'EFFECT', 'UI_ANIMATION'
        this.data = {};
    }
}

export class UIStateUpdateState {
    constructor() {
        this.type = null;
        this.data = {};
        this.isCompleted = false;
    }
}

export class AiActionState {
    constructor() {
        this.isActive = false;
    }
}

export class CheckActionCancellationState {
    constructor() {
        this.isActive = false;
    }
}

export class UIInputState {
    constructor() {
        this.isActive = false;
        this.type = null; // 'NAVIGATE' | 'CONFIRM' | 'CANCEL'
        this.data = {};
    }
}

/**
 * 進行中のTweenを表すコンポーネント
 * AnimationSystemがこれを処理し、完了時に削除する。
 */
export class ActiveTween {
    /**
     * @param {object} params
     * @param {number} params.targetId - 対象エンティティID
     * @param {string} params.type - Tweenの種類 ('HP_UPDATE'など)
     * @param {string} params.partKey - (HP_UPDATE用) 対象パーツキー
     * @param {number} params.start - 開始値
     * @param {number} params.end - 終了値
     * @param {number} params.duration - 期間(ms)
     * @param {string} [params.easing='linear'] - イージング関数名
     * @param {number} [params.parentId=null] - 完了通知先の親エンティティID
     */
    constructor({ targetId, type, partKey, start, end, duration, easing = 'linear', parentId = null }) {
        this.targetId = targetId;
        this.type = type;
        this.partKey = partKey;
        this.start = start;
        this.end = end;
        this.duration = duration;
        this.easing = easing;
        this.parentId = parentId;
        
        this.elapsed = 0;
    }
}

/**
 * Tween完了通知タグ
 * ActiveTween完了時にparentIdのエンティティに付与される
 */
export class TweenCompletedSignal {
    constructor() {}
}