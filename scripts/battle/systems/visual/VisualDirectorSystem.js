/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出を一元管理する監督システム。
 * Task経由のリクエストを受け、処理完了後に完了イベントを返す。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { TaskType } from '../../tasks/BattleTasks.js';
import { ModalType } from '../../common/constants.js';

export class VisualDirectorSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.REQUEST_TASK_EXECUTION, this.onRequestTaskExecution.bind(this));
    }

    onRequestTaskExecution(detail) {
        const { task, taskId } = detail;
        
        // 完了報告用ヘルパー
        const complete = () => {
            this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId });
        };

        switch (task.type) {
            case TaskType.ANIMATE:
                // AnimationSystemが処理するので無視
                break;
                
            case TaskType.VFX:
                // VFX処理 (仮実装)
                console.log(`[VisualDirector] Play VFX: ${task.effectName}`);
                complete();
                break;
                
            case TaskType.CAMERA:
                // Camera処理 (仮実装)
                console.log(`[VisualDirector] Camera Action: ${task.action}`);
                complete();
                break;
                
            case TaskType.DIALOG:
                this._handleDialog(task, complete);
                break;
                
            case TaskType.UI_ANIMATION:
                this._handleUiAnimation(task, complete);
                break;
        }
    }

    _handleDialog(task, onComplete) {
        // モーダル表示を要求
        // ActionPanelSystemがモーダルを閉じたタイミングでコールバックを呼んでもらう必要がある
        // 現状のActionPanelSystemは onComplete コールバックをサポートしているので、それを渡す。
        const modalData = {
            type: task.options.modalType || ModalType.MESSAGE,
            data: { 
                message: task.text,
                ...task.options 
            },
            messageSequence: [{ text: task.text }],
            onComplete: onComplete 
        };

        this.world.emit(GameEvents.SHOW_MODAL, modalData);
    }

    _handleUiAnimation(task, onComplete) {
        if (task.targetType === 'HP_BAR') {
            // HPバーアニメーション要求
            this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, task.data);
            
            // 完了イベントを待機
            this.world.waitFor(GameEvents.HP_BAR_ANIMATION_COMPLETED, null, 2000)
                .then(() => onComplete())
                .catch(() => onComplete()); // タイムアウトしても完了扱いにして進める

        } else {
            onComplete();
        }
    }
}