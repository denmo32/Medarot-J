/**
 * @file TaskRunner.js
 * @description タスクキューを管理し、順次実行するクラス。
 * ポリモーフィズム導入により実装を簡素化。
 */
export class TaskRunner {
    constructor(world) {
        this.world = world;
        this.queue = [];
        this.currentTask = null;
        this.isProcessing = false;
    }

    /**
     * タスクリストを追加して実行開始
     * @param {Array} tasks 
     */
    addTasks(tasks) {
        this.queue.push(...tasks);
    }

    /**
     * キューをクリアして停止
     */
    clear() {
        this.queue = [];
        this.currentTask = null;
        this.isProcessing = false;
    }

    update(deltaTime) {
        // 現在のタスクがあれば更新
        if (this.currentTask) {
            this.currentTask.update(deltaTime);
            return;
        }

        // タスクがなく、キューに残っていれば次を開始
        if (!this.isProcessing && this.queue.length > 0) {
            this._startNextTask();
        }
    }

    _startNextTask() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        this.currentTask = this.queue.shift();

        // タスク実行 (完了コールバックを渡す)
        try {
            this.currentTask.execute(this.world, () => {
                this._completeTask();
            });
        } catch (error) {
            console.error("Error executing task:", error, this.currentTask);
            this._completeTask(); // エラー時はスキップ
        }
    }

    _completeTask() {
        this.currentTask = null;
        // isProcessingは維持し、次のupdateループで即座に次へ進むか、
        // あるいはここで再帰的に _startNextTask を呼ぶか。
        // スタックオーバーフロー防止のため、フラグ管理にとどめ次のupdateを待つのが安全。
        // ただし、1フレームに複数タスク消化したい場合（イベント発行など）はループが必要。
        // ここではシンプルに「updateごとに進行」または「同期タスクは即時完了して次へ」の挙動を
        // Task.complete() -> callback -> _completeTask のフローで制御する。
        
        // 同期的に完了した場合、このメソッド内で this.currentTask が null になる。
        // 連続実行を許可する場合:
        if (this.queue.length > 0) {
            // setTimeout(() => this._startNextTask(), 0); // 非同期で次へ
            // または
            this._startNextTask(); // 同期的に次へ（スタック注意だがパフォーマンス良）
        } else {
            this.isProcessing = false;
        }
    }
    
    get isIdle() {
        return !this.isProcessing && !this.currentTask && this.queue.length === 0;
    }
}