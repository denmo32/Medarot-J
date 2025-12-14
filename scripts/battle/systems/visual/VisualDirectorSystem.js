/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出を一元管理する監督システム。
 * イベント監視を廃止し、リクエスト/結果コンポーネントの監視へ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { ModalType } from '../../common/constants.js';
import {
    DialogTask, VfxTask, CameraTask
} from '../../components/Tasks.js';
import { ModalRequest, ModalClosedResult } from '../../components/Requests.js';

export class VisualDirectorSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // --- Modal Closed Check ---
        // モーダルが閉じたことを検知し、対応するDialogTaskを完了させる
        this._processModalClosedResults();

        // --- Dialog ---
        this._processDialogTasks();

        // --- VFX ---
        this._processInstantTasks(VfxTask, (task) => console.log(`[VisualDirector] Play VFX: ${task.effectName}`));

        // --- Camera ---
        this._processInstantTasks(CameraTask, (task) => console.log(`[VisualDirector] Camera Action: ${task.action}`));
    }

    _processModalClosedResults() {
        const results = this.getEntities(ModalClosedResult);
        for (const entityId of results) {
            const result = this.world.getComponent(entityId, ModalClosedResult);
            this._handleModalClosed(result);
            this.world.destroyEntity(entityId); // 結果コンポーネントを消費
        }
    }

    _handleModalClosed(result) {
        const { taskId } = result;
        if (!taskId) return;

        // taskIdに一致するDialogTaskを探して削除（完了扱いにする）
        const entities = this.getEntities(DialogTask);
        for (const entityId of entities) {
            const task = this.world.getComponent(entityId, DialogTask);
            
            if (task.isDisplayed && task.taskId === taskId) {
                this.world.removeComponent(entityId, DialogTask);
                break; // 1つのモーダルにつき1つのタスクと仮定
            }
        }
    }

    _processDialogTasks() {
        const entities = this.getEntities(DialogTask);
        for (const entityId of entities) {
            const task = this.world.getComponent(entityId, DialogTask);
            
            if (!task.isDisplayed) {
                // ModalRequestコンポーネントを生成してModalSystemへ依頼
                const reqEntity = this.world.createEntity();
                this.world.addComponent(reqEntity, new ModalRequest(
                    task.options?.modalType || ModalType.MESSAGE,
                    { 
                        message: task.text,
                        ...task.options 
                    },
                    {
                        messageSequence: [{ text: task.text }],
                        taskId: task.taskId,
                        priority: 'normal'
                    }
                ));
                
                task.isDisplayed = true;
            }
        }
    }

    _processInstantTasks(ComponentClass, actionFn) {
        const entities = this.getEntities(ComponentClass);
        for (const entityId of entities) {
            const task = this.world.getComponent(entityId, ComponentClass);
            actionFn(task);
            this.world.removeComponent(entityId, ComponentClass);
        }
    }
}