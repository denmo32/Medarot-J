/**
 * @file VisualDirectorSystem.js
 * @description バトル中の視覚演出を一元管理する監督システム。
 * Requestコンポーネントを監視して処理を振り分ける。
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
        // Modalが閉じられたときのイベントを監視し、DialogRequestを削除するために必要
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));
    }

    update(deltaTime) {
        // DialogRequests
        const dialogRequests = this.getEntities(DialogRequest);
        for (const entityId of dialogRequests) {
            this._processDialogRequest(entityId);
        }

        // VfxRequests
        const vfxRequests = this.getEntities(VfxRequest);
        for (const entityId of vfxRequests) {
            // VFXは即時実行->即削除（非同期待ちがない場合）
            const request = this.world.getComponent(entityId, VfxRequest);
            console.log(`[VisualDirector] Play VFX: ${request.effectName}`);
            this.world.removeComponent(entityId, VfxRequest);
        }

        // CameraRequests
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
            // モーダル表示要求
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: request.options.modalType || ModalType.MESSAGE,
                data: { 
                    message: request.text,
                    ...request.options 
                },
                messageSequence: [{ text: request.text }],
                // onCompleteコールバックはActionPanelSystemで呼ばれるが、
                // ECS的にはイベントや状態監視で同期したい。
                // 既存のActionPanelSystemはイベント駆動なので、
                // ここでは「モーダルを閉じたら MODAL_CLOSED が飛ぶ」ことを利用して、
                // リクエストの削除を行う。
                
                // ただし、どのリクエストに対応するモーダルかを識別する必要がある。
                // 簡易的に「現在表示中のDialogRequestは1つ」という前提で動くか、
                // requestオブジェクト自体にIDを持たせて照合する。
                taskId: entityId // taskIdとしてエンティティIDを渡しておく（ActionPanelSystemが返してくれる場合）
            });
            request.isDisplayed = true;
        }
    }

    onModalClosed(detail) {
        // モーダルが閉じられたら、対応するDialogRequestを探して削除する
        // Detailに識別子が含まれていればベストだが、なければ
        // isDisplayed = true になっているものを削除する（直列実行前提）
        
        const dialogRequests = this.getEntities(DialogRequest);
        for (const entityId of dialogRequests) {
            const request = this.world.getComponent(entityId, DialogRequest);
            if (request.isDisplayed) {
                this.world.removeComponent(entityId, DialogRequest);
                // 1つ消せば十分（通常は直列）
                break;
            }
        }
    }
}