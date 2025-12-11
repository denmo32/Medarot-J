/**
 * @file TaskRunner.js
 * @description タスクキューをECSのアップデートサイクルに合わせて処理するランナー。
 */
import { releaseTask } from './BattleTasks.js';

export class TaskRunner {
    constructor(world) {
        this.world = world;
        this.taskQueue = [];
        this.currentTask = null;
        this.currentActorId = null;
        this.isPaused = false;
    }

    setSequence(tasks, actorId = null) {
        this.abort(); 
        this.taskQueue = [...tasks];
        this.currentActorId = actorId;
        this.currentTask = null;
    }

    addTask(task) {
        this.taskQueue.push(task);
    }

    abort() {
        if (this.currentTask) {
            this.currentTask.abort(this.world);
            releaseTask(this.currentTask);
        }
        // 待機中のタスクも全て解放する
        while(this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            releaseTask(task);
        }
        
        this.taskQueue = [];
        this.currentTask = null;
        this.currentActorId = null;
    }

    update(deltaTime) {
        if (this.isPaused) return;

        if (!this.currentTask && this.taskQueue.length === 0) {
            return;
        }

        if (!this.currentTask) {
            this.currentTask = this.taskQueue.shift();
            this.currentTask.start(this.world, this.currentActorId);
        }

        if (this.currentTask) {
            this.currentTask.update(this.world, deltaTime);

            if (this.currentTask.isCompleted) {
                // 完了したらプールへ返却
                releaseTask(this.currentTask);
                this.currentTask = null;
            }
        }
    }

    get isIdle() {
        return !this.currentTask && this.taskQueue.length === 0;
    }
}