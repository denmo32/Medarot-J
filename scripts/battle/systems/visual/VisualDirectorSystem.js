/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出を一元管理する監督システム。
 * イベント発行を廃止し、ModalRequestコンポーネントの生成へ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import {
    DialogTask, VfxTask, CameraTask
} from '../../components/Tasks.js';
import { ModalRequest } from '../../components/Requests.js';

export class VisualDirectorSystem extends System {
    constructor(world) {
        super(world);
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        // 完了通知はイベントとして受け取る（System間通信の簡易化のため維持）
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));
    }

    update(deltaTime) {
        // --- Dialog ---
        this._processDialogTasks();

        // --- VFX ---
        this._processInstantTasks(VfxTask, (task) => console.log(`[VisualDirector] Play VFX: ${task.effectName}`));

        // --- Camera ---
        this._processInstantTasks(CameraTask, (task) => console.log(`[VisualDirector] Camera Action: ${task.action}`));
    }

    _processDialogTasks() {
        const entities = this.getEntities(DialogTask);
        for (const entityId of entities) {
            const task = this.world.getComponent(entityId, DialogTask);
            
            if (!task.isDisplayed) {
                // イベント発行ではなく、リクエストコンポーネントを生成
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

    onModalClosed(detail) {
        const { taskId } = detail;
        
        // DialogTaskの削除
        const entities = this.getEntities(DialogTask);
        for (const entityId of entities) {
            const task = this.world.getComponent(entityId, DialogTask);
            
            if (task.isDisplayed && task.taskId === taskId) {
                this.world.removeComponent(entityId, DialogTask);
                break; // 1つのモーダルにつき1つのタスク
            }
        }
    }
}