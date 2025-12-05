/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出を一元管理する監督システム。
 * TaskRunnerからのコールバックを受け取り、完了時に実行する。
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

    onRequestTaskExecution(task) {
        // onCompleteコールバックが存在しない場合は即時終了扱いにする防御的記述
        const onComplete = task.onComplete || (() => {});

        switch (task.type) {
            case TaskType.ANIMATE:
                // AnimationSystemが処理するためここでは何もしない
                // (重複処理を防ぐため)
                break;
            case TaskType.VFX:
                this._handleVfx(task, onComplete);
                break;
            case TaskType.CAMERA:
                this._handleCamera(task, onComplete);
                break;
            case TaskType.DIALOG:
                this._handleDialog(task, onComplete);
                break;
            case TaskType.UI_ANIMATION:
                this._handleUiAnimation(task, onComplete);
                break;
            case 'MESSAGE': 
                // Legacy support (ActionPanelSystem might handle, or we wrap it)
                break;
        }
    }

    _handleVfx(task, onComplete) {
        console.log(`[VisualDirector] Play VFX: ${task.effectName}`);
        // TODO: VfxSystemの実装。現状はログのみで即完了。
        onComplete();
    }

    _handleCamera(task, onComplete) {
        console.log(`[VisualDirector] Camera Action: ${task.action}`);
        // TODO: CameraSystemの実装。現状はログのみで即完了。
        onComplete();
    }

    _handleDialog(task, onComplete) {
        // ActionPanelSystem (UI) に表示を要求
        // onComplete をモーダルデータに含めて渡す
        const modalData = {
            type: task.options.modalType || ModalType.MESSAGE,
            data: { 
                message: task.text,
                ...task.options 
            },
            messageSequence: [{ text: task.text }],
            onComplete: onComplete // 完了時にActionPanelSystemに呼んでもらう
        };

        this.world.emit(GameEvents.SHOW_MODAL, modalData);
    }

    _handleUiAnimation(task, onComplete) {
        if (task.targetType === 'HP_BAR') {
            // HPバーアニメーション要求
            this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, task.data);
            
            // アニメーション完了を待つ (AnimationSystemからの完了イベントを購読)
            // ここはまだイベントベースだが、AnimationSystemを全面的に書き換えるリスクを抑えるため
            // 局所的なイベントリスナーで対応する
            const completionHandler = () => {
                this.world.off(GameEvents.HP_BAR_ANIMATION_COMPLETED, completionHandler);
                onComplete();
            };
            this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, completionHandler);

        } else {
            onComplete();
        }
    }
}