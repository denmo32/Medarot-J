/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出を一元管理する監督システム。
 * DialogRequest, VfxRequest, CameraRequest, DialogTask, VfxTask, CameraTask を処理する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { 
    DialogRequest, VfxRequest, CameraRequest 
} from '../../components/VisualRequest.js';
import {
    DialogTask, VfxTask, CameraTask
} from '../../components/Tasks.js';

export class VisualDirectorSystem extends System {
    constructor(world) {
        super(world);
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));
    }

    update(deltaTime) {
        // --- Dialog ---
        this._processDialogEntities(DialogRequest, DialogRequest); // 旧
        this._processDialogEntities(DialogTask, DialogTask);       // 新

        // --- VFX ---
        this._processInstantEntities(VfxRequest, (req) => console.log(`[VisualDirector] Play VFX: ${req.effectName}`));
        this._processInstantEntities(VfxTask, (task) => console.log(`[VisualDirector] Play VFX: ${task.effectName}`));

        // --- Camera ---
        this._processInstantEntities(CameraRequest, (req) => console.log(`[VisualDirector] Camera Action: ${req.action}`));
        this._processInstantEntities(CameraTask, (task) => console.log(`[VisualDirector] Camera Action: ${task.action}`));
    }

    _processDialogEntities(ComponentClass, DataClass) {
        const entities = this.getEntities(ComponentClass);
        for (const entityId of entities) {
            const component = this.world.getComponent(entityId, ComponentClass);
            
            if (!component.isDisplayed) {
                // Taskの場合は taskId、Requestの場合は id プロパティ
                const taskId = component.taskId || component.id;
                
                this.world.emit(GameEvents.SHOW_MODAL, {
                    type: component.options?.modalType || ModalType.MESSAGE,
                    data: { 
                        message: component.text,
                        ...component.options 
                    },
                    messageSequence: [{ text: component.text }],
                    taskId: taskId 
                });
                component.isDisplayed = true;
            }
        }
    }

    _processInstantEntities(ComponentClass, actionFn) {
        const entities = this.getEntities(ComponentClass);
        for (const entityId of entities) {
            const component = this.world.getComponent(entityId, ComponentClass);
            actionFn(component);
            this.world.removeComponent(entityId, ComponentClass);
        }
    }

    onModalClosed(detail) {
        const { taskId } = detail;
        
        // DialogRequestの削除
        this._removeDialogByTaskId(DialogRequest, taskId);
        // DialogTaskの削除
        this._removeDialogByTaskId(DialogTask, taskId);
    }

    _removeDialogByTaskId(ComponentClass, targetTaskId) {
        const entities = this.getEntities(ComponentClass);
        for (const entityId of entities) {
            const component = this.world.getComponent(entityId, ComponentClass);
            const currentTaskId = component.taskId || component.id;
            
            if (component.isDisplayed && currentTaskId === targetTaskId) {
                this.world.removeComponent(entityId, ComponentClass);
                break; // 1つのモーダルにつき1つのタスク/リクエスト
            }
        }
    }
}