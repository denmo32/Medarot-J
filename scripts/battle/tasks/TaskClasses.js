/**
 * @file TaskClasses.js
 * @description バトルタスクのクラス定義。
 * 各タスクは自身の実行ロジック(execute, update)をカプセル化する。
 */
import { TaskType } from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { Position } from '../components/index.js';

/**
 * タスク基底クラス
 */
export class BattleTask {
    constructor(type) {
        this.type = type;
        this.id = Math.random().toString(36).substr(2, 9);
        this._onComplete = null;
    }

    /**
     * タスクの実行を開始する
     * @param {World} world 
     * @param {Function} onComplete 完了時に呼ぶコールバック
     */
    execute(world, onComplete) {
        this._onComplete = onComplete;
        // サブクラスで実装
        // 同期処理なら即座に this.complete() を呼ぶ
    }

    /**
     * 毎フレームの更新（必要な場合）
     * @param {number} deltaTime 
     */
    update(deltaTime) {
        // サブクラスで実装
    }

    /**
     * タスク完了を通知する
     */
    complete() {
        if (this._onComplete) {
            const callback = this._onComplete;
            this._onComplete = null;
            callback();
        }
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

    execute(world, onComplete) {
        super.execute(world, onComplete);
        this.elapsed = 0;
        // durationが0以下の場合は即時完了
        if (this.duration <= 0) {
            this.complete();
        }
    }

    update(deltaTime) {
        if (!this._onComplete) return;
        
        this.elapsed += deltaTime;
        if (this.elapsed >= this.duration) {
            this.complete();
        }
    }
}

/**
 * エンティティを移動させるタスク
 */
export class MoveTask extends BattleTask {
    constructor(entityId, targetX, targetY, duration) {
        super(TaskType.MOVE);
        this.entityId = entityId;
        this.targetX = targetX;
        this.targetY = targetY;
        this.duration = duration;
        
        // 実行時状態
        this.elapsed = 0;
        this.startX = 0;
        this.startY = 0;
        this.world = null; // updateでコンポーネント取得するため保持
    }

    execute(world, onComplete) {
        super.execute(world, onComplete);
        this.world = world;
        this.elapsed = 0;

        const pos = world.getComponent(this.entityId, Position);
        if (pos) {
            this.startX = pos.x;
            this.startY = pos.y;
        } else {
            // Positionがない場合は即完了
            this.complete();
        }
    }

    update(deltaTime) {
        if (!this._onComplete) return;

        this.elapsed += deltaTime;
        const progress = Math.min(this.elapsed / this.duration, 1.0);
        // Ease Out Quad
        const t = 1 - (1 - progress) * (1 - progress);

        const pos = this.world.getComponent(this.entityId, Position);
        if (pos) {
            pos.x = this.startX + (this.targetX - this.startX) * t;
            pos.y = this.startY + (this.targetY - this.startY) * t;
        }

        if (progress >= 1.0) {
            this.complete();
        }
    }
}

/**
 * 状態変化を適用するタスク
 */
export class ApplyStateTask extends BattleTask {
    constructor(applyFn) {
        super(TaskType.APPLY_STATE);
        this.applyFn = applyFn;
    }

    execute(world, onComplete) {
        if (this.applyFn) {
            this.applyFn(world);
        }
        onComplete();
    }
}

/**
 * イベントを発行するタスク
 */
export class EventTask extends BattleTask {
    constructor(eventName, detail) {
        super(TaskType.EVENT);
        this.eventName = eventName;
        this.detail = detail;
    }

    execute(world, onComplete) {
        world.emit(this.eventName, this.detail);
        onComplete();
    }
}

/**
 * 任意の非同期処理を実行するタスク
 */
export class CustomTask extends BattleTask {
    constructor(executeFn) {
        super(TaskType.CUSTOM);
        this.executeFn = executeFn;
    }

    async execute(world, onComplete) {
        if (this.executeFn) {
            await this.executeFn(world);
        }
        onComplete();
    }
}

/**
 * 外部システムへ処理を委譲するタスク (演出系)
 * VisualDirectorSystem等がイベントを受け取って処理し、onCompleteを呼ぶまで待機する
 */
export class DelegateTask extends BattleTask {
    constructor(type, params = {}) {
        super(type);
        // paramsの内容をthisに展開（システム側が task.attackerId 等でアクセスするため）
        Object.assign(this, params);
    }

    execute(world, onComplete) {
        super.execute(world, onComplete);
        
        // システム側に実行要求イベントを発行
        // Taskオブジェクト自体(this)にonCompleteが含まれている必要がある
        // (VisualDirectorSystemの実装依存: task.onComplete() を呼ぶ)
        this.onComplete = () => {
            this.complete();
        };

        world.emit(GameEvents.REQUEST_TASK_EXECUTION, this);
    }
}