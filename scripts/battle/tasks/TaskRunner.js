/**
 * @file TaskRunner.js
 * @description タスクキューを管理し、順次実行するクラス。
 * イベントベースの完了通知を廃止し、コールバック方式に刷新。
 */
import { TaskType } from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { Position } from '../components/index.js';

export class TaskRunner {
    constructor(world) {
        this.world = world;
        this.queue = [];
        this.currentTask = null;
        this.isProcessing = false;
        this.isWaitingForAsync = false;
        this.elapsedTime = 0;
    }

    /**
     * タスクリストを追加して実行開始
     * @param {Array} tasks 
     */
    addTasks(tasks) {
        // ID生成ロジックはデバッグ用として残すが、制御には使用しない
        tasks.forEach(task => {
            if (!task.id) task.id = Math.random().toString(36).substr(2, 9);
        });
        this.queue.push(...tasks);
    }

    /**
     * キューをクリアして停止
     */
    clear() {
        this.queue = [];
        this.currentTask = null;
        this.isProcessing = false;
        this.isWaitingForAsync = false;
    }

    update(deltaTime) {
        // 非同期処理待ち（アニメーション、ダイアログ等）中は更新しない
        if (this.isWaitingForAsync) {
            return;
        }

        if (!this.isProcessing && this.queue.length > 0) {
            this._startNextTask();
        }

        // 時間経過で管理するタスク（Wait, Moveなど）の更新
        if (this.currentTask && !this.isWaitingForAsync) {
            this._updateCurrentTask(deltaTime);
        }
    }

    async _startNextTask() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        this.currentTask = this.queue.shift();
        this.elapsedTime = 0;

        // タスク完了時のコールバック
        // これを各システムに渡すことで、イベントを経由せずに完了を通知させる
        const onComplete = () => {
            this.isWaitingForAsync = false;
            this._completeTask();
        };

        try {
            switch (this.currentTask.type) {
                case TaskType.WAIT:
                    // updateで時間経過を待つ
                    break;

                case TaskType.MOVE:
                    // 初期位置を記録
                    const pos = this.world.getComponent(this.currentTask.entityId, Position);
                    if (pos) {
                        this.currentTask._startX = pos.x;
                        this.currentTask._startY = pos.y;
                    } else {
                        this._completeTask();
                    }
                    break;
                
                case TaskType.APPLY_STATE:
                    if (this.currentTask.applyFn) {
                        this.currentTask.applyFn(this.world);
                    }
                    this._completeTask();
                    break;

                case TaskType.EVENT:
                    this.world.emit(this.currentTask.eventName, this.currentTask.detail);
                    this._completeTask();
                    break;

                case TaskType.CUSTOM:
                    if (this.currentTask.execute) {
                        await this.currentTask.execute(this.world);
                    }
                    this._completeTask();
                    break;
                
                case TaskType.ANIMATE:
                case TaskType.MESSAGE:
                case TaskType.DIALOG:
                case TaskType.VFX:
                case TaskType.CAMERA:
                case TaskType.UI_ANIMATION:
                    // 外部システムに委譲。onCompleteを渡して制御を預ける
                    this.isWaitingForAsync = true;
                    // Taskオブジェクト自体にコールバックを含めてイベント発行
                    this.world.emit(GameEvents.REQUEST_TASK_EXECUTION, { 
                        ...this.currentTask, 
                        onComplete 
                    });
                    break;

                default:
                    console.warn(`Delegating unknown task type: ${this.currentTask.type}`);
                    this.isWaitingForAsync = true;
                    this.world.emit(GameEvents.REQUEST_TASK_EXECUTION, { 
                        ...this.currentTask, 
                        onComplete 
                    });
                    break;
            }
        } catch (error) {
            console.error("Error starting task:", error);
            this._completeTask(); // エラー時はスキップして次へ
        }
    }

    _updateCurrentTask(deltaTime) {
        if (!this.currentTask) return;

        this.elapsedTime += deltaTime;

        switch (this.currentTask.type) {
            case TaskType.WAIT:
                if (this.elapsedTime >= this.currentTask.duration) {
                    this._completeTask();
                }
                break;

            case TaskType.MOVE:
                const { entityId, targetX, targetY, duration, _startX, _startY } = this.currentTask;
                const progress = Math.min(this.elapsedTime / duration, 1.0);
                // イージング関数 (Ease Out Quad)
                const t = 1 - (1 - progress) * (1 - progress);

                const pos = this.world.getComponent(entityId, Position);
                if (pos) {
                    pos.x = _startX + (targetX - _startX) * t;
                    pos.y = _startY + (targetY - _startY) * t;
                }

                if (progress >= 1.0) {
                    this._completeTask();
                }
                break;
        }
    }

    _completeTask() {
        this.currentTask = null;
        this.isProcessing = false;
        this.isWaitingForAsync = false;
    }
    
    get isIdle() {
        return !this.isProcessing && !this.isWaitingForAsync && this.queue.length === 0;
    }
}