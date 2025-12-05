/**
 * @file TaskRunner.js
 * @description タスクキューを管理し、順次実行するクラス
 */
import { TaskType } from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { Position } from '../components/index.js';
import { System } from '../../../engine/core/System.js';

export class TaskRunner {
    constructor(world) {
        this.world = world;
        this.queue = [];
        this.currentTask = null;
        this.isProcessing = false;
        this.isWaitingForEvent = false;
        this.elapsedTime = 0;

        // イベントリスナーの登録（SystemではないがWorldのイベントバスを使用）
        this.world.on(GameEvents.TASK_EXECUTION_COMPLETED, this.onTaskExecutionCompleted.bind(this));
    }

    /**
     * タスクリストを追加して実行開始
     * @param {Array} tasks 
     */
    addTasks(tasks) {
        // IDを付与（完了通知との照合用）
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
        this.isWaitingForEvent = false;
    }

    update(deltaTime) {
        // イベント待ち中は新たなタスクを開始しない
        if (this.isWaitingForEvent) {
            return;
        }

        if (!this.isProcessing && this.queue.length > 0) {
            this._startNextTask();
        }

        // 継続的な更新が必要なタスク（Wait, Moveなど）の処理
        if (this.currentTask && !this.isWaitingForEvent) {
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
                        this._completeTask(); // コンポーネントがない場合はスキップ
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
                    // 外部システムに委譲
                    this.isWaitingForEvent = true;
                    this.world.emit(GameEvents.REQUEST_TASK_EXECUTION, this.currentTask);
                    break;

                default:
                    // 未知のタスクタイプも汎用的に外部委譲を試みる
                    console.log(`Delegating unknown task type: ${this.currentTask.type}`);
                    this.isWaitingForEvent = true;
                    this.world.emit(GameEvents.REQUEST_TASK_EXECUTION, this.currentTask);
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

    onTaskExecutionCompleted(detail) {
        // 現在実行中のタスク完了通知か確認（簡易実装として、待ち状態なら完了とする）
        if (this.isWaitingForEvent && this.currentTask) {
             // taskId照合（あれば）
            if (detail && detail.taskId && detail.taskId !== this.currentTask.id) {
                return;
            }
            this.isWaitingForEvent = false;
            this._completeTask();
        }
    }

    _completeTask() {
        this.currentTask = null;
        this.isProcessing = false;
        this.isWaitingForEvent = false;
    }
    
    get isIdle() {
        return !this.isProcessing && !this.isWaitingForEvent && this.queue.length === 0;
    }
}