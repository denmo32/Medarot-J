/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出（アニメーション、VFX、カメラ、UI表示）を一元管理する監督システム。
 * TaskRunnerから演出要求を受け取り、適切なサブシステム（AnimationSystem, ActionPanelSystem等）に命令を出す。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { TaskType } from '../../tasks/BattleTasks.js';
import { ModalType } from '../../common/constants.js';

export class VisualDirectorSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.REQUEST_TASK_EXECUTION, this.onRequestTaskExecution.bind(this));
        
        // モーダル完了イベントを監視して、DIALOGタスクの完了をTaskRunnerに通知する
        this.on(GameEvents.MODAL_SEQUENCE_COMPLETED, this.onModalSequenceCompleted.bind(this));
    }

    onRequestTaskExecution(task) {
        switch (task.type) {
            case TaskType.ANIMATE:
                this._handleAnimate(task);
                break;
            case TaskType.VFX:
                this._handleVfx(task);
                break;
            case TaskType.CAMERA:
                this._handleCamera(task);
                break;
            case TaskType.DIALOG:
                this._handleDialog(task);
                break;
            case TaskType.UI_ANIMATION:
                this._handleUiAnimation(task);
                break;
            // MESSAGEは互換性のために残すが、基本はDIALOG推奨
            case 'MESSAGE': 
                this._handleLegacyMessage(task);
                break;
        }
    }

    _handleAnimate(task) {
        // AnimationSystemへ委譲（本来はここから詳細な命令を出すべきだが、現状はイベント転送）
        // AnimationSystem側でアニメーション完了後に TASK_EXECUTION_COMPLETED を発行する必要があるが、
        // 既存の AnimationSystem は REQUEST_TASK_EXECUTION を直接監視しているため、
        // ここでは何もしなくて良い（二重処理になるため）。
        // ★リファクタリングの過渡期として、AnimationSystem側のイベント監視を維持しつつ、
        // 徐々にこちらのメソッドへロジックを移動する。
        // 今回は「VisualDirectorが介入する」形にするため、AnimationSystem側の直接監視を削除し、
        // ここから専用イベント（PLAY_UNIT_ANIMATION）を投げるのが理想。
        // 一旦、AnimationSystem.js の改修を最小限にするため、
        // AnimationSystem は引き続き REQUEST_TASK_EXECUTION を監視してもらうが、
        // 将来的にはここが「演出の司令塔」になる。
    }

    _handleVfx(task) {
        console.log(`[VisualDirector] Play VFX: ${task.effectName}`);
        // TODO: VfxSystemの実装。現状はログのみで即完了。
        this._completeTask(task.id);
    }

    _handleCamera(task) {
        console.log(`[VisualDirector] Camera Action: ${task.action}`);
        // TODO: CameraSystemの実装。現状はログのみで即完了。
        this._completeTask(task.id);
    }

    _handleDialog(task) {
        // ActionPanelSystem (UI) に表示を要求
        const modalData = {
            type: task.options.modalType || ModalType.MESSAGE,
            data: { 
                message: task.text,
                ...task.options 
            },
            taskId: task.id // タスクIDを渡して、完了時に通知してもらう
        };
        
        // メッセージシーケンスとして渡す（ActionPanelSystemの仕様に合わせる）
        modalData.messageSequence = [{ text: task.text }];

        this.world.emit(GameEvents.SHOW_MODAL, modalData);
    }

    _handleUiAnimation(task) {
        if (task.targetType === 'HP_BAR') {
            // HPバーアニメーション要求
            this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, task.data);
            
            // アニメーション完了を待つ（AnimationSystemが完了イベントを出す）
            // TaskRunnerへの通知は、AnimationSystemが行うか、
            // あるいは HP_BAR_ANIMATION_COMPLETED をここで監視して通知するか。
            // 疎結合のため、ここでイベントを監視して完了通知を送るのが良い。
            const onComplete = () => {
                this.world.off(GameEvents.HP_BAR_ANIMATION_COMPLETED, onComplete);
                this._completeTask(task.id);
            };
            this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, onComplete);
        } else {
            this._completeTask(task.id);
        }
    }

    _handleLegacyMessage(task) {
        // 既存のMESSAGEタスク（ActionPanelSystemが直接処理していたもの）
        // 何もしない（ActionPanelSystemに任せる）か、ここで仲介する。
        // ActionPanelSystemのイベントリスナーを残すなら、ここでは何もしない。
    }

    onModalSequenceCompleted(detail) {
        // モーダル（ダイアログ）が閉じられたらタスク完了
        // detail.originalData に taskId が含まれているはず
        if (detail.originalData && detail.originalData.taskId) {
            // TaskRunnerは taskId が一致する完了通知のみを受け付ける
            // ここで明示的に通知は不要かもしれない（ActionPanelSystemが完了通知を出している場合）
            // 確認: ActionPanelSystem._finishCurrentModal で TASK_EXECUTION_COMPLETED を出している。
            // よって、ここでは何もしなくて良い。
        }
    }

    _completeTask(taskId) {
        this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId });
    }
}