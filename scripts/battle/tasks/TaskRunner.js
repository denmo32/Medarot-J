/**
 * @file TaskRunner.js
 * @description タスクキューを順次実行するクラス。Async/Await対応版。
 */
export class TaskRunner {
    constructor(world) {
        this.world = world;
        this.currentTask = null;
        this.isProcessing = false;
        // 実行中断用のフラグ
        this.abortController = null;
    }

    /**
     * タスクリストを順次実行する。
     * このメソッドは非同期であり、全てのタスクが完了するまでPromiseを返さない。
     * @param {Array} tasks 
     */
    async run(tasks) {
        if (this.isProcessing) {
            console.warn('TaskRunner is already running. Parallel execution is not supported.');
            return;
        }

        this.isProcessing = true;
        this.abortController = new AbortController(); // キャンセル用

        try {
            for (const task of tasks) {
                if (this.abortController.signal.aborted) {
                    break;
                }
                
                this.currentTask = task;
                
                // タスクの実行と待機
                await task.execute(this.world);
                
                this.currentTask = null;
            }
        } catch (error) {
            console.error('Error during task execution:', error);
        } finally {
            this.isProcessing = false;
            this.currentTask = null;
            this.abortController = null;
        }
    }

    /**
     * 実行中のタスクシーケンスを強制停止する
     */
    abort() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isProcessing = false;
        this.currentTask = null;
    }
    
    get isIdle() {
        return !this.isProcessing;
    }

    update(deltaTime) {
        // 現在実行中のタスクがあれば更新処理を呼ぶ
        // (MoveTaskなど、requestAnimationFrameを使わずdeltaTimeで制御する場合用)
        if (this.currentTask && typeof this.currentTask.update === 'function') {
            this.currentTask.update(deltaTime);
        }
    }
}