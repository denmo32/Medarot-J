/**
 * @file TaskClasses.js
 * @description バトルタスクのクラス定義。
 * Phase 4: オブジェクトプール対応 (resetメソッドの実装)
 */
import { TaskType } from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { Position } from '../components/index.js';
import { Parts } from '../../components/index.js';
import { 
    AnimationRequest, 
    VfxRequest, 
    DialogRequest, 
    UiAnimationRequest, 
    CameraRequest 
} from '../components/VisualRequest.js';
import { executeCommands } from '../logic/commandExecutor.js'; // 新規インポート

export class BattleTask {
    constructor(type) {
        this.type = type;
        this.isStarted = false;
        this.isCompleted = false;
    }
    
    reset() {
        this.isStarted = false;
        this.isCompleted = false;
    }

    start(world, entityId) { this.isStarted = true; }
    update(world, deltaTime) {}
    abort(world) { this.isCompleted = true; }
}

export class WaitTask extends BattleTask {
    constructor() {
        super(TaskType.WAIT);
        this.duration = 0;
        this.elapsed = 0;
    }
    
    init(duration) {
        this.duration = duration;
        this.elapsed = 0;
        return this;
    }

    reset() {
        super.reset();
        this.duration = 0;
        this.elapsed = 0;
    }

    update(world, deltaTime) {
        this.elapsed += deltaTime;
        if (this.elapsed >= this.duration) this.isCompleted = true;
    }
}

export class MoveTask extends BattleTask {
    constructor() {
        super(TaskType.MOVE);
        this.entityId = null;
        this.targetX = 0;
        this.targetY = 0;
        this.duration = 0;
        this.elapsed = 0;
        this.startX = 0;
        this.startY = 0;
    }

    init(entityId, targetX, targetY, duration) {
        this.entityId = entityId;
        this.targetX = targetX;
        this.targetY = targetY;
        this.duration = duration;
        this.elapsed = 0;
        this.startX = 0;
        this.startY = 0;
        return this;
    }

    reset() {
        super.reset();
        this.entityId = null;
        this.targetX = 0;
        this.targetY = 0;
        this.duration = 0;
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
            this.isCompleted = true;
        }
    }
    update(world, deltaTime) {
        const pos = world.getComponent(this.entityId, Position);
        if (!pos) {
            this.isCompleted = true; return;
        }
        this.elapsed += deltaTime;
        const progress = Math.min(this.elapsed / this.duration, 1.0);
        const t = 1 - (1 - progress) * (1 - progress);
        pos.x = this.startX + (this.targetX - this.startX) * t;
        pos.y = this.startY + (this.targetY - this.startY) * t;
        if (progress >= 1.0) this.isCompleted = true;
    }
}

export class RequestComponentTask extends BattleTask {
    constructor(type) {
        super(type);
        this.componentFactory = null;
        this.targetEntityId = null;
        this.attachedEntityId = null;
        this.componentClass = null;
    }

    init(componentFactory, targetEntityId) {
        this.componentFactory = componentFactory;
        this.targetEntityId = targetEntityId;
        return this;
    }

    reset() {
        super.reset();
        this.componentFactory = null;
        this.targetEntityId = null;
        this.attachedEntityId = null;
        this.componentClass = null;
    }

    start(world, actorEntityId) {
        super.start(world, actorEntityId);
        this.attachedEntityId = this.targetEntityId !== null ? this.targetEntityId : actorEntityId;
        if (this.attachedEntityId === null) {
            this.isCompleted = true; return;
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
            this.isCompleted = true; return;
        }
        if (!world.getComponent(this.attachedEntityId, this.componentClass)) {
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

// 具体的なリクエストタスクはファクトリで生成するクロージャが異なるだけなので
// RequestComponentTask を直接利用するか、プール管理のためにクラスを分ける。
// ここではプール管理を単純化するため、各クラスを維持しつつ init を実装する。

export class AnimateTask extends RequestComponentTask {
    constructor() { super(TaskType.ANIMATE); }
    init(attackerId, targetId, animationType) {
        super.init(() => new AnimationRequest(animationType, targetId), attackerId);
        return this;
    }
}
export class VfxTask extends RequestComponentTask {
    constructor() { super(TaskType.VFX); }
    init(effectName, position) {
        super.init(() => new VfxRequest(effectName, position), null);
        return this;
    }
}
export class DialogTask extends RequestComponentTask {
    constructor() { super(TaskType.DIALOG); }
    init(text, options) {
        super.init(() => new DialogRequest(text, options), null);
        return this;
    }
}
export class UiAnimationTask extends RequestComponentTask {
    constructor() { super(TaskType.UI_ANIMATION); }
    init(targetType, data) {
        super.init(() => new UiAnimationRequest(targetType, data), null);
        return this;
    }
}
export class CameraTask extends RequestComponentTask {
    constructor() { super(TaskType.CAMERA); }
    init(action, params) {
        super.init(() => new CameraRequest(action, params), null);
        return this;
    }
}

export class InstantTask extends BattleTask {
    constructor(type) {
        super(type);
        this.executeFn = null;
    }
    
    init(executeFn) {
        this.executeFn = executeFn;
        return this;
    }

    reset() {
        super.reset();
        this.executeFn = null;
    }

    start(world, entityId) {
        super.start(world, entityId);
        if (this.executeFn) this.executeFn(world, entityId);
        this.isCompleted = true;
    }
}

export class ApplyStateTask extends InstantTask {
    constructor() {
        super(TaskType.APPLY_STATE);
        this.commands = [];
    }

    init(commands) {
        this.commands = commands || [];
        return this;
    }

    reset() {
        super.reset();
        this.commands = [];
    }

    start(world, entityId) {
        // InstantTaskのstartは呼ばず、ここで完結させる
        this.isStarted = true;
        executeCommands(world, this.commands);
        this.isCompleted = true;
    }
}

export class EventTask extends InstantTask {
    constructor() { super(TaskType.EVENT); }
    init(eventName, detail) {
        super.init((world) => world.emit(eventName, detail));
        return this;
    }
}
export class CustomTask extends InstantTask {
    constructor() { super(TaskType.CUSTOM); }
    init(executeFn) {
        super.init(executeFn);
        return this;
    }
}