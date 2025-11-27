/**
 * @file TaskRunner.js
 * @description タスクキューを管理し、順次実行するクラス
 */
import { TaskType } from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
import { UIManager } from '../../../engine/ui/UIManager.js';
import { Position } from '../components/index.js';
import { ViewSystem } from '../systems/ui/ViewSystem.js';
import { MessageSystem } from '../systems/mechanics/MessageSystem.js';

export class TaskRunner {
    constructor(world) {
        this.world = world;
        this.queue = [];
        this.currentTask = null;
        this.isProcessing = false;
        this.elapsedTime = 0;

        // 外部システムへの参照キャッシュ
        this._viewSystem = null;
        this._messageSystem = null;
    }

    // 遅延取得用ゲッター
    get viewSystem() {
        if (!this._viewSystem) {
            this._viewSystem = this.world.systems.find(s => s instanceof ViewSystem);
        }
        return this._viewSystem;
    }

    get messageSystem() {
        if (!this._messageSystem) {
            this._messageSystem = this.world.systems.find(s => s instanceof MessageSystem);
        }
        return this._messageSystem;
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
        if (!this.isProcessing && this.queue.length > 0) {
            this._startNextTask();
        }

        if (this.currentTask) {
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

                case TaskType.ANIMATE:
                    if (this.viewSystem) {
                        await this.viewSystem.playAnimation(this.currentTask);
                    } else {
                        console.warn('[TaskRunner] ViewSystem not found.');
                    }
                    this._completeTask();
                    break;

                case TaskType.MESSAGE:
                    if (this.messageSystem) {
                        await this.messageSystem.showMessage(this.currentTask);
                    } else {
                        console.warn('[TaskRunner] MessageSystem not found.');
                    }
                    this._completeTask();
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

                default:
                    console.warn(`Unknown task type: ${this.currentTask.type}`);
                    this._completeTask();
            }
        } catch (error) {
            console.error("Error executing task:", error);
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
    }
    
    get isIdle() {
        return !this.isProcessing && this.queue.length === 0;
    }
}