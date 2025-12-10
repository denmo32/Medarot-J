/**
 * @file TaskRunner.js
 * @description タスクキューをECSのアップデートサイクルに合わせて処理するランナー。
 * async/awaitを排除し、毎フレーム update() でタスクの進行を管理する。
 */
export class TaskRunner {
    constructor(world) {
        this.world = world;
        this.taskQueue = [];
        this.currentTask = null;
        this.currentActorId = null; // タスク実行の主体（いれば）
        this.isPaused = false;
    }

    /**
     * 新しいタスクシーケンスを設定する
     * @param {Array} tasks 
     * @param {number|null} actorId 
     */
    setSequence(tasks, actorId = null) {
        this.abort(); // 既存タスクがあれば中断
        this.taskQueue = [...tasks];
        this.currentActorId = actorId;
        this.currentTask = null;
    }

    /**
     * タスクを追加する
     * @param {Object} task 
     */
    addTask(task) {
        this.taskQueue.push(task);
    }

    /**
     * 強制停止
     */
    abort() {
        if (this.currentTask) {
            this.currentTask.abort(this.world);
        }
        this.taskQueue = [];
        this.currentTask = null;
        this.currentActorId = null;
    }

    /**
     * 毎フレームの更新
     * @param {number} deltaTime 
     */
    update(deltaTime) {
        if (this.isPaused) return;

        // タスクがない場合
        if (!this.currentTask && this.taskQueue.length === 0) {
            return;
        }

        // 新しいタスクの開始
        if (!this.currentTask) {
            this.currentTask = this.taskQueue.shift();
            // 開始処理
            this.currentTask.start(this.world, this.currentActorId);
        }

        // タスクの更新
        if (this.currentTask) {
            this.currentTask.update(this.world, deltaTime);

            // 完了チェック
            if (this.currentTask.isCompleted) {
                this.currentTask = null;
                // 次のフレームで次のタスクを開始
            }
        }
    }

    get isIdle() {
        return !this.currentTask && this.taskQueue.length === 0;
    }
}