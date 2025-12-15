/**
 * @file ModalSystem.js
 * @description モーダルの状態管理とフロー制御を行うシステム。
 * AiDecisionServiceの静的化に伴い修正。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleUIState } from '../../components/index.js';
import { modalHandlers } from '../../ui/modalHandlers.js';
import { ModalType } from '../../common/constants.js';
import { AiDecisionService } from '../../services/AiDecisionService.js';
import { ActionService } from '../../services/ActionService.js';
import { 
    ModalRequest, 
    ModalClosedResult,
    UIInputIntent, 
    UIStateUpdateRequest,
    ActionRequeueRequest,
    PlayerInputRequiredRequest,
    HpBarAnimationRequest,
    BattleStartConfirmedTag,
    BattleStartCancelledTag,
    ResetButtonResult
} from '../../components/Requests.js';
import { PauseState } from '../../components/PauseState.js';

export class ModalSystem extends System {
    constructor(world) {
        super(world);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        this.handlers = modalHandlers;
        // AiDecisionServiceはステートレスなオブジェクトのためインスタンス化不要
    }

    update(deltaTime) {
        // 1. 新規モーダルリクエストの処理
        this._processModalRequests();
        
        // 2. プレイヤー入力要求の処理
        this._processPlayerInputRequests();

        // 3. モーダルキューの処理 (表示開始)
        if (!this.uiState.isProcessingQueue && this.uiState.modalQueue.length > 0) {
            this._startNextModalInQueue();
        }

        // 4. UI状態更新リクエストの処理 (アニメーション完了など)
        this._processStateUpdateRequests();

        // 5. ユーザー入力インテントの処理
        this._processInputIntents();
    }

    // --- Request Processing ---

    _processModalRequests() {
        const requests = this.getEntities(ModalRequest);
        for (const entityId of requests) {
            const request = this.world.getComponent(entityId, ModalRequest);
            // キューに追加
            this.uiState.modalQueue.push({
                type: request.type,
                data: request.data,
                messageSequence: request.messageSequence,
                taskId: request.taskId,
                onComplete: request.onComplete,
                priority: request.priority
            });
            this.world.destroyEntity(entityId);
        }
    }
    
    _processPlayerInputRequests() {
        const requests = this.getEntities(PlayerInputRequiredRequest);
        for (const reqId of requests) {
            const request = this.world.getComponent(reqId, PlayerInputRequiredRequest);
            
            // モーダルデータの準備
            const handler = this.handlers[ModalType.SELECTION];
            if (handler && handler.prepareData) {
                const modalData = handler.prepareData({ 
                    world: this.world, 
                    data: { entityId: request.entityId }, 
                    services: { aiService: AiDecisionService } // オブジェクトを直接渡す
                });

                if (modalData) {
                    const modalReq = this.world.createEntity();
                    this.world.addComponent(modalReq, new ModalRequest(ModalType.SELECTION, modalData, { priority: 'high' }));
                } else {
                    // データ準備失敗時はリキュー
                    const req = this.world.createEntity();
                    this.world.addComponent(req, new ActionRequeueRequest(request.entityId));
                }
            }
            
            this.world.destroyEntity(reqId);
        }
    }

    _processStateUpdateRequests() {
        const requests = this.getEntities(UIStateUpdateRequest);
        for (const entityId of requests) {
            const req = this.world.getComponent(entityId, UIStateUpdateRequest);
            if (req.type === 'ANIMATION_COMPLETED' && this.uiState.isWaitingForAnimation) {
                this.uiState.isWaitingForAnimation = false;
                this.proceedToNextSequence();
            }
            this.world.destroyEntity(entityId);
        }
    }

    // --- Queue Management ---

    _startNextModalInQueue() {
        if (this.uiState.modalQueue.length === 0) {
            this.uiState.isProcessingQueue = false;
            return;
        }

        this.uiState.isProcessingQueue = true;
        const modalContext = this.uiState.modalQueue.shift();
        
        this.uiState.currentModalType = modalContext.type;
        this.uiState.currentModalData = modalContext.data;
        this.uiState.currentTaskId = modalContext.taskId || null;
        this.uiState.currentModalCallback = modalContext.onComplete || null;
        this.uiState.currentMessageSequence = modalContext.messageSequence || [{}];
        this.uiState.currentSequenceIndex = 0;

        // ポーズ状態への遷移 (PauseStateコンポーネントを付与)
        if (this.getEntities(PauseState).length === 0) {
            const pauseEntity = this.world.createEntity();
            this.world.addComponent(pauseEntity, new PauseState());
        }

        this.displayCurrentSequenceStep();
    }

    // --- Input Processing ---

    _processInputIntents() {
        // UIが表示されていない、またはアニメーション待機中は入力を無視
        if (!this.uiState.isPanelVisible || this.uiState.isWaitingForAnimation) {
            const intents = this.getEntities(UIInputIntent);
            for (const id of intents) this.world.destroyEntity(id);
            return;
        }

        const intents = this.getEntities(UIInputIntent);
        for (const entityId of intents) {
            const intent = this.world.getComponent(entityId, UIInputIntent);
            
            switch (intent.type) {
                case 'NAVIGATE':
                    this._handleUserInput('handleNavigation', intent.data.direction);
                    break;
                case 'CONFIRM':
                    this._handleUserInput('handleConfirm');
                    break;
                case 'CANCEL':
                    this._handleUserInput('handleCancel');
                    break;
            }
            
            this.world.destroyEntity(entityId);
        }
    }

    // --- Logic ---

    displayCurrentSequenceStep() {
        const handler = this.handlers[this.uiState.currentModalType];
        if (!handler) {
            console.warn(`ModalSystem: No handler for type "${this.uiState.currentModalType}"`);
            this.finishCurrentModal();
            return;
        }
        
        const currentStep = this.uiState.currentMessageSequence[this.uiState.currentSequenceIndex] || {};

        if (currentStep.waitForAnimation) {
            this.uiState.isWaitingForAnimation = true;
            
            const req = this.world.createEntity();
            this.world.addComponent(req, new HpBarAnimationRequest(
                currentStep.effects || this.uiState.currentModalData.appliedEffects || []
            ));
            
            // UI状態が変わったため、ActionPanelSystemがそれを検知して更新する
            return;
        }
        this.uiState.isWaitingForAnimation = false;

        // 描画データ更新
        const displayData = { ...this.uiState.currentModalData, currentMessage: currentStep };
        this.uiState.ownerText = handler.getOwnerName?.(displayData) || '';
        this.uiState.titleText = handler.getTitle?.(displayData) || '';
        this.uiState.actorText = handler.getActorName?.(displayData) || displayData.currentMessage?.text || '';
        this.uiState.buttonsData = this.uiState.currentModalData?.buttons || [];
        this.uiState.isPanelVisible = true;
        this.uiState.isPanelClickable = !!handler.isClickable;

        // 初期化処理
        if (handler.init) {
            const action = handler.init({ data: this.uiState.currentModalData, uiState: this.uiState });
            this._executeAction(action);
        }
        
        // ActionPanelSystemはこれらのステート変更を検知して描画を行う
    }
    
    proceedToNextSequence() {
        if (this.uiState.isWaitingForAnimation) return;

        this.uiState.currentSequenceIndex++;
        if (this.uiState.currentSequenceIndex < this.uiState.currentMessageSequence.length) {
            this.displayCurrentSequenceStep();
        } else {
            this.finishCurrentModal();
        }
    }

    finishCurrentModal() {
        if (typeof this.uiState.currentModalCallback === 'function') {
            this.uiState.currentModalCallback();
        }

        // モーダル終了結果コンポーネントを生成 (VisualDirectorSystemなどが利用)
        const resultEntity = this.world.createEntity();
        this.world.addComponent(resultEntity, new ModalClosedResult(
            this.uiState.currentModalType,
            this.uiState.currentTaskId
        ));

        this.hideCurrentModal();
    }

    hideCurrentModal() {
        if (this.uiState.isPanelVisible) {
            // ポーズ解除
            const pauseEntities = this.getEntities(PauseState);
            for (const id of pauseEntities) this.world.destroyEntity(id);
        }
        this.uiState.reset();
        this.uiState.isProcessingQueue = false;
    }

    _handleUserInput(handlerName, ...args) {
        const handler = this.handlers[this.uiState.currentModalType];
        if (handler && typeof handler[handlerName] === 'function') {
            const context = { data: this.uiState.currentModalData, uiState: this.uiState };
            const action = handler[handlerName](context, ...args);
            this._executeAction(action);
        }
    }

    _executeAction(action) {
        if (!action) return;

        switch(action.action) {
            case 'EMIT_AND_CLOSE': 
                // イベント名に基づいて適切なリクエストやタグを生成
                if (action.eventName === 'PART_SELECTED') {
                    ActionService.createActionRequest(
                        this.world, 
                        action.detail.entityId, 
                        action.detail.partKey, 
                        action.detail.target
                    );
                } else if (action.eventName === 'BATTLE_START_CONFIRMED') {
                    this.world.addComponent(this.world.createEntity(), new BattleStartConfirmedTag());
                } else if (action.eventName === 'BATTLE_START_CANCELLED') {
                    this.world.addComponent(this.world.createEntity(), new BattleStartCancelledTag());
                } else if (action.eventName === 'RESET_BUTTON_CLICKED') {
                    this.world.addComponent(this.world.createEntity(), new ResetButtonResult());
                }
                
                this.finishCurrentModal();
                break;

            case 'CLOSE_MODAL':
                this.finishCurrentModal();
                break;

            case 'PROCEED_SEQUENCE':
                this.proceedToNextSequence();
                break;

            case 'UPDATE_FOCUS':
                if (this.uiState.focusedButtonKey !== action.key) {
                    this.uiState.focusedButtonKey = action.key;
                }
                break;
        }
    }
}