/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出を一元管理する監督システム。
 * RequestIDを用いた厳密な同期処理を実装。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { 
    DialogRequest, 
    VfxRequest, 
    CameraRequest 
} from '../../components/VisualRequest.js';

export class VisualDirectorSystem extends System {
    constructor(world) {
        super(world);
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));
    }

    update(deltaTime) {
        const dialogRequests = this.getEntities(DialogRequest);
        for (const entityId of dialogRequests) {
            this._processDialogRequest(entityId);
        }

        const vfxRequests = this.getEntities(VfxRequest);
        for (const entityId of vfxRequests) {
            const request = this.world.getComponent(entityId, VfxRequest);
            console.log(`[VisualDirector] Play VFX: ${request.effectName}`);
            this.world.removeComponent(entityId, VfxRequest);
        }

        const cameraRequests = this.getEntities(CameraRequest);
        for (const entityId of cameraRequests) {
            const request = this.world.getComponent(entityId, CameraRequest);
            console.log(`[VisualDirector] Camera Action: ${request.action}`);
            this.world.removeComponent(entityId, CameraRequest);
        }
    }

    _processDialogRequest(entityId) {
        const request = this.world.getComponent(entityId, DialogRequest);
        
        if (!request.isDisplayed) {
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: request.options.modalType || ModalType.MESSAGE,
                data: { 
                    message: request.text,
                    ...request.options 
                },
                messageSequence: [{ text: request.text }],
                taskId: request.id // Request自体のIDを渡す
            });
            request.isDisplayed = true;
        }
    }

    onModalClosed(detail) {
        const { taskId } = detail; // 閉じられたモーダルのtaskId (RequestID)
        
        const dialogRequests = this.getEntities(DialogRequest);
        for (const entityId of dialogRequests) {
            const request = this.world.getComponent(entityId, DialogRequest);
            // IDが一致するものだけを削除
            if (request.isDisplayed && request.id === taskId) {
                this.world.removeComponent(entityId, DialogRequest);
                break;
            }
        }
    }
}