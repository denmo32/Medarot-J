/**
 * @file MessageSystem.js
 * @description メッセージとモーダルの表示管理。
 * イベント駆動による自動表示は廃止し、タスクや明示的な表示要求(`SHOW_MODAL`)のみに応答する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { TaskType } from '../../tasks/BattleTasks.js';

export class MessageSystem extends System {
    constructor(world) {
        super(world);
        // ActionCancellationSystem等で生成済みメッセージを表示するため、Generatorはここでは基本使用しないが
        // 汎用的なフォーマットが必要な場合に備えて保持、もしくは削除検討可能。
        // 今回の設計変更で、表示内容は呼び出し元が作って渡す形を推奨する。
        
        // モーダル制御用のPromise解決関数保持用
        this.pendingResolvers = new Map();
        
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        // モーダルが閉じたときのイベントを監視
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));

        // タスク実行要求を監視
        this.on(GameEvents.REQUEST_TASK_EXECUTION, this.onRequestTaskExecution.bind(this));
        
        // 注: ACTION_CANCELLED などのロジックイベントを監視して直接メッセージを出す処理は廃止。
        // 表示が必要な場合は、発生元が SHOW_MODAL を発行するか、TimelineBuilderがメッセージタスクを生成する。
    }

    onRequestTaskExecution(task) {
        if (task.type !== TaskType.MESSAGE) return;

        this._executeMessageTask(task).then(() => {
            this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId: task.id });
        });
    }

    /**
     * メッセージタスクを処理 (Internal Async)
     * @param {object} task 
     */
    _executeMessageTask(task) {
        return new Promise((resolve) => {
            const { modalType, data, messageSequence } = task;
            
            // モーダルタイプをキーにしてResolverを保存
            this.pendingResolvers.set(modalType, resolve);

            // ActionPanelSystemに対してモーダル表示要求を発行
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: modalType,
                data: data,
                messageSequence: messageSequence,
                immediate: true,
            });
        });
    }

    onModalClosed(detail) {
        const { modalType } = detail;
        const resolve = this.pendingResolvers.get(modalType);
        if (resolve) {
            this.pendingResolvers.delete(modalType);
            resolve();
        }
    }
}