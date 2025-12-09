/**
 * @file TaskClasses.js
 * @description バトルタスクのクラス定義。
 * async/await ベースの実装へ刷新。
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
    }

    /**
     * タスクの実行を開始する
     * @param {World} world 
     * @returns {Promise<void>}
     */
    async execute(world) {
        // サブクラスで実装
    }

    /**
     * 毎フレームの更新（必要な場合）
     * TaskRunnerがawaitしている間、並行してupdateを呼び出す場合に使用するが、
     * 基本的にPromise内で完結させる設計とする。
     * アニメーションなどフレームごとの更新が必要な場合は、Promise内でrequestAnimationFrameループ等を回すか、
     * 外部システムに委譲して完了イベントを待つ。
     * @param {number} deltaTime 
     */
    update(deltaTime) {
        // 必要ならサブクラスで実装
    }
}

/**
 * 指定時間待機するタスク
 */
export class WaitTask extends BattleTask {
    constructor(duration) {
        super(TaskType.WAIT);
        this.duration = duration;
    }

    execute(world) {
        return new Promise(resolve => setTimeout(resolve, this.duration));
    }
}

/**
 * エンティティを移動させるタスク (簡易実装: JS制御)
 * 本格的なアニメーションはAnimationSystemへ委譲することを推奨するが、
 * 簡易的な補間ロジックとしてここに残す。
 */
export class MoveTask extends BattleTask {
    constructor(entityId, targetX, targetY, duration) {
        super(TaskType.MOVE);
        this.entityId = entityId;
        this.targetX = targetX;
        this.targetY = targetY;
        this.duration = duration;
    }

    execute(world) {
        return new Promise(resolve => {
            const pos = world.getComponent(this.entityId, Position);
            if (!pos) {
                resolve();
                return;
            }

            const startX = pos.x;
            const startY = pos.y;
            let elapsed = 0;
            let lastTime = performance.now();

            const loop = (currentTime) => {
                const dt = currentTime - lastTime;
                lastTime = currentTime;
                elapsed += dt;

                const progress = Math.min(elapsed / this.duration, 1.0);
                // Ease Out Quad
                const t = 1 - (1 - progress) * (1 - progress);

                pos.x = startX + (this.targetX - startX) * t;
                pos.y = startY + (this.targetY - startY) * t;

                if (progress < 1.0) {
                    requestAnimationFrame(loop);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(loop);
        });
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

    async execute(world) {
        if (this.applyFn) {
            this.applyFn(world);
        }
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

    async execute(world) {
        world.emit(this.eventName, this.detail);
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

    async execute(world) {
        if (this.executeFn) {
            await this.executeFn(world);
        }
    }
}

/**
 * 外部システムへ処理を委譲するタスク (演出系)
 * イベントを発行し、完了イベントが返ってくるのを待つ。
 */
export class DelegateTask extends BattleTask {
    constructor(type, params = {}) {
        super(type);
        Object.assign(this, params);
        // デフォルトの完了イベント名（システム側でこれをemitすることを期待）
        this.completionEvent = GameEvents.TASK_EXECUTION_COMPLETED;
    }

    execute(world) {
        return new Promise((resolve, reject) => {
            // 完了イベントの待機
            // payload.taskId が一致するものだけを拾う
            world.waitFor(
                this.completionEvent,
                (detail) => detail && detail.taskId === this.id,
                10000 // タイムアウト(10秒)
            ).then(() => {
                resolve();
            }).catch(err => {
                console.warn(`Task ${this.type} (${this.id}) timed out or failed:`, err);
                resolve(); // エラーでも進行を止めない
            });

            // 実行要求イベントの発行
            world.emit(GameEvents.REQUEST_TASK_EXECUTION, {
                task: this,
                taskId: this.id, // システム側が返送するためにIDを明示
                ...this // paramsを展開
            });
        });
    }
}