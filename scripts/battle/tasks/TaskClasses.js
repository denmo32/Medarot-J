/**
 * @file TaskClasses.js
 * @description バトルタスクのクラス定義。
 * コンポーネントベースの状態管理へ移行し、Promise/async-await依存を排除。
 */
import { TaskType } from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { Position } from '../components/index.js';
import { 
    AnimationRequest, 
    VfxRequest, 
    DialogRequest, 
    UiAnimationRequest, 
    CameraRequest 
} from '../components/VisualRequest.js';

/**
 * タスク基底クラス
 */
export class BattleTask {
    constructor(type) {
        this.type = type;
        this.isStarted = false;
        this.isCompleted = false;
    }

    /**
     * タスクの実行を開始する（初回のみ呼ばれる）
     * @param {World} world 
     * @param {number} entityId - タスクの主体となるエンティティID（nullの場合あり）
     */
    start(world, entityId) {
        this.isStarted = true;
    }

    /**
     * 毎フレームの更新処理
     * @param {World} world 
     * @param {number} deltaTime 
     */
    update(world, deltaTime) {
        // 完了条件を満たしたら this.isCompleted = true にする
    }

    /**
     * 強制終了時のクリーンアップ
     * @param {World} world 
     */
    abort(world) {
        this.isCompleted = true;
    }
}

/**
 * 指定時間待機するタスク
 */
export class WaitTask extends BattleTask {
    constructor(duration) {
        super(TaskType.WAIT);
        this.duration = duration;
        this.elapsed = 0;
    }

    update(world, deltaTime) {
        this.elapsed += deltaTime;
        if (this.elapsed >= this.duration) {
            this.isCompleted = true;
        }
    }
}

/**
 * エンティティを移動させるタスク (簡易実装)
 */
export class MoveTask extends BattleTask {
    constructor(entityId, targetX, targetY, duration) {
        super(TaskType.MOVE);
        this.entityId = entityId;
        this.targetX = targetX;
        this.targetY = targetY;
        this.duration = duration;
        this.elapsed = 0;
        this.startX = 0;
        this.startY = 0;
    }

    start(world) {
        super.start(world);
        const pos = world.getComponent(this.entityId, Position);
        if (pos) {
            this.startX = pos.x;
            this.startY = pos.y;
        } else {
            this.isCompleted = true; // 移動対象がいない
        }
    }

    update(world, deltaTime) {
        const pos = world.getComponent(this.entityId, Position);
        if (!pos) {
            this.isCompleted = true;
            return;
        }

        this.elapsed += deltaTime;
        const progress = Math.min(this.elapsed / this.duration, 1.0);
        // Ease Out Quad
        const t = 1 - (1 - progress) * (1 - progress);

        pos.x = this.startX + (this.targetX - this.startX) * t;
        pos.y = this.startY + (this.targetY - this.startY) * t;

        if (progress >= 1.0) {
            this.isCompleted = true;
        }
    }
}

/**
 * 汎用リクエストタスク基底クラス
 * 指定されたコンポーネントを付与し、そのコンポーネントが削除されるのを待つ
 */
export class RequestComponentTask extends BattleTask {
    /**
     * @param {string} type TaskType
     * @param {Function} componentFactory (entityId) => Component インスタンスを生成する関数
     * @param {number|null} targetEntityId コンポーネントを付与する対象。nullの場合は実行主体(actor)に付与
     */
    constructor(type, componentFactory, targetEntityId = null) {
        super(type);
        this.componentFactory = componentFactory;
        this.targetEntityId = targetEntityId;
        this.attachedEntityId = null;
        this.componentClass = null;
    }

    start(world, actorEntityId) {
        super.start(world, actorEntityId);
        
        // ターゲットが指定されていなければ実行主体を使う
        this.attachedEntityId = this.targetEntityId !== null ? this.targetEntityId : actorEntityId;

        // それでも対象がなければ（システムタスク等）、一時エンティティを作る手もあるが、
        // 今回はVisualRequestなので「演出用のダミーエンティティ」が必要かもしれない。
        // ここでは便宜上、実行主体が必須とする。
        if (this.attachedEntityId === null) {
            console.warn(`Task ${this.type}: No target entity to attach component.`);
            this.isCompleted = true;
            return;
        }

        const component = this.componentFactory(this.attachedEntityId);
        if (component) {
            this.componentClass = component.constructor;
            world.addComponent(this.attachedEntityId, component);
        } else {
            this.isCompleted = true;
        }
    }

    update(world, deltaTime) {
        if (!this.attachedEntityId || !this.componentClass) {
            this.isCompleted = true;
            return;
        }

        // コンポーネントが削除されていたら完了とみなす
        const component = world.getComponent(this.attachedEntityId, this.componentClass);
        if (!component) {
            this.isCompleted = true;
        }
    }

    abort(world) {
        if (this.attachedEntityId && this.componentClass) {
            world.removeComponent(this.attachedEntityId, this.componentClass);
        }
        super.abort(world);
    }
}

// --- 具体的なリクエストタスク ---

export class AnimateTask extends RequestComponentTask {
    constructor(attackerId, targetId, animationType) {
        super(TaskType.ANIMATE, () => new AnimationRequest(animationType, targetId), attackerId);
    }
}

export class VfxTask extends RequestComponentTask {
    constructor(effectName, position) {
        // VFXは特定のエンティティに紐付かない場合が多いので、専用のエンティティを作るか、シーン管理エンティティにつける。
        // ここでは簡易的に「エフェクト管理用エンティティ」を動的生成するアプローチをとるか、
        // 既存の仕組みに合わせて actorId につける。
        // VfxRequestは VisualDirectorSystem が拾うので、誰についていても良い。
        super(TaskType.VFX, () => new VfxRequest(effectName, position));
    }
}

export class DialogTask extends RequestComponentTask {
    constructor(text, options) {
        // DialogRequestはVisualDirectorSystemが処理。
        super(TaskType.DIALOG, () => new DialogRequest(text, options));
    }
}

export class UiAnimationTask extends RequestComponentTask {
    constructor(targetType, data) {
        super(TaskType.UI_ANIMATION, () => new UiAnimationRequest(targetType, data));
    }
}

export class CameraTask extends RequestComponentTask {
    constructor(action, params) {
        super(TaskType.CAMERA, () => new CameraRequest(action, params));
    }
}

/**
 * 即時実行タスク（1フレームで完了）
 */
export class InstantTask extends BattleTask {
    constructor(type, executeFn) {
        super(type);
        this.executeFn = executeFn;
    }

    start(world, entityId) {
        super.start(world, entityId);
        if (this.executeFn) {
            this.executeFn(world, entityId);
        }
        this.isCompleted = true;
    }
}

export class ApplyStateTask extends InstantTask {
    constructor(applyFn) {
        super(TaskType.APPLY_STATE, applyFn);
    }
}

export class EventTask extends InstantTask {
    constructor(eventName, detail) {
        super(TaskType.EVENT, (world) => world.emit(eventName, detail));
    }
}

export class CustomTask extends InstantTask {
    constructor(executeFn) {
        super(TaskType.CUSTOM, executeFn);
    }
}