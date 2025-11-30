/**
 * @file MessageSystem.js
 * @description メッセージとモーダルの表示管理。タスクからの呼び出しに対応。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType, ActionCancelReason } from '../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';
import { PlayerInfo } from '../../../components/index.js';
import { MessageGenerator } from '../../utils/MessageGenerator.js';
import { TaskType } from '../../tasks/BattleTasks.js';

const cancelReasonToMessageKey = {
    [ActionCancelReason.PART_BROKEN]: MessageKey.CANCEL_PART_BROKEN,
    [ActionCancelReason.TARGET_LOST]: MessageKey.CANCEL_TARGET_LOST,
    [ActionCancelReason.INTERRUPTED]: MessageKey.CANCEL_INTERRUPTED,
};

export class MessageSystem extends System {
    constructor(world) {
        super(world);
        this.messageGenerator = new MessageGenerator(world);
        
        this.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        // GUARD_BROKEN, GUARD_EXPIRED は TimelineBuilder のシーケンス内で表示制御するため、
        // ここでのイベント駆動リスナーは削除し、重複表示やタイミングの不整合を防ぐ。
        
        // モーダル制御用のPromise解決関数保持用
        this.pendingResolvers = new Map();
        
        // モーダルが閉じたときのイベントを監視
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));

        // タスク実行要求を監視
        this.on(GameEvents.REQUEST_TASK_EXECUTION, this.onRequestTaskExecution.bind(this));
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

    onActionCancelled(detail) {
        const { entityId, reason } = detail;
        const actorInfo = this.world.getComponent(entityId, PlayerInfo);
        if (!actorInfo) return;

        const messageKey = cancelReasonToMessageKey[reason];
        if (!messageKey) return;
        
        const message = this.messageGenerator.format(messageKey, { actorName: actorInfo.name });
        
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }
}