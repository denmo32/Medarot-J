/**
 * @file ModalSystem.js
 * @description モーダルの状態管理とフロー制御を行うシステム。
 * イベント駆動からコンポーネント監視（Polling）へリファクタリング。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattleUIState } from '../../components/index.js';
import { modalHandlers } from '../../ui/modalHandlers.js';
import { ModalType } from '../../common/constants.js';
import { AiDecisionService } from '../../services/AiDecisionService.js';
import { ActionService } from '../../services/ActionService.js';
import { 
    ModalRequest, 
    CloseModalRequest, 
    UIInputIntent, 
    UIStateUpdateRequest,
    ActionRequeueRequest
} from '../../components/Requests.js';

export class ModalSystem extends System {
    constructor(world) {
        super(world);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        this.handlers = modalHandlers;
        this.aiDecisionService = new AiDecisionService(world);

        // イベントリスナーはアニメーション完了通知などの副作用的なものに限定するか、
        // 完全にコンポーネントベースにする。ここではプレイヤー入力要求のみイベントとして残すが
        // 本来はコンポーネントで通知されるべき。
        // リファクタリング: PLAYER_INPUT_REQUIRED は ActionSelectionSystem からイベントとして発行されているため
        // ここでは受信するが、内部ロジックはコンポーネント操作にする。
        this.on(GameEvents.PLAYER_INPUT_REQUIRED, this.onPlayerInputRequired.bind(this));
    }

    update(deltaTime) {
        // 1. 新規モーダルリクエストの処理
        this._processModalRequests();

        // 2. モーダルキューの処理 (表示開始)
        if (!this.uiState.isProcessingQueue && this.uiState.modalQueue.length > 0) {
            this._startNextModalInQueue();
        }

        // 3. UI状態更新リクエストの処理 (アニメーション完了など)
        this._processStateUpdateRequests();

        // 4. ユーザー入力インテントの処理
        this._processInputIntents();
    }

    // --- Request Processing ---

    _processModalRequests() {
        const requests = this.getEntities(ModalRequest);
        for (const entityId of requests) {
            const request = this.world.getComponent(entityId, ModalRequest);
            // キューに追加（シンプルなオブジェクトに変換して保持）
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
        
        // イベント互換用: HP_BAR_ANIMATION_COMPLETEDイベントも監視したい場合
        // System.on() でリッスンして UIStateUpdateRequest を発行する形にするのがECS的だが
        // ここでは簡略化のためイベントハンドラを直接使うことはしない（ループ内で完結させる）。
        // 外部システム（AnimationSystem）は完了時に UIStateUpdateRequest を発行すべき。
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

        this.world.emit(GameEvents.GAME_PAUSED); // ポーズ状態への遷移
        this.displayCurrentSequenceStep();
    }

    // --- Input Processing ---

    _processInputIntents() {
        // UIが表示されていない、またはアニメーション待機中は入力を無視
        if (!this.uiState.isPanelVisible || this.uiState.isWaitingForAnimation) {
            // インテントがあっても消費して捨てる
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
            this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, { 
                appliedEffects: currentStep.effects || this.uiState.currentModalData.appliedEffects || []
            });
            this.world.emit(GameEvents.UI_STATE_CHANGED);
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

        this.world.emit(GameEvents.UI_STATE_CHANGED);
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

        this.world.emit(GameEvents.MODAL_CLOSED, {
            modalType: this.uiState.currentModalType,
            taskId: this.uiState.currentTaskId
        });

        this.hideCurrentModal();
    }

    hideCurrentModal() {
        if (this.uiState.isPanelVisible) {
            this.world.emit(GameEvents.GAME_RESUMED);
        }
        this.uiState.reset();
        this.world.emit(GameEvents.UI_STATE_CHANGED);
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

        // modalHandlersが返すアクション定義をコンポーネント操作等に変換
        switch(action.action) {
            case 'EMIT':
                this.world.emit(action.eventName, action.detail);
                break;
                
            case 'EMIT_AND_CLOSE': // 主にPART_SELECTEDなどで使用
                // ハンドラから返されたイベント名に基づいて処理を分岐
                if (action.eventName === GameEvents.PART_SELECTED) {
                    // ActionServiceへ委譲
                    ActionService.createActionRequest(
                        this.world, 
                        action.detail.entityId, 
                        action.detail.partKey, 
                        action.detail.target
                    );
                } else {
                    // その他のイベントはそのまま発行
                    this.world.emit(action.eventName, action.detail);
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
                    this.world.emit(GameEvents.UI_STATE_CHANGED);
                }
                break;
        }
    }

    // --- Handlers for External Events ---

    onPlayerInputRequired(detail) {
        const handler = this.handlers[ModalType.SELECTION];
        if (!handler || !handler.prepareData) return;
        
        const modalData = handler.prepareData({ 
            world: this.world, 
            data: detail, 
            services: { aiService: this.aiDecisionService } 
        });

        if (modalData) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new ModalRequest(ModalType.SELECTION, modalData, { priority: 'high' }));
        } else {
            // データ準備失敗時はリキュー
            const req = this.world.createEntity();
            this.world.addComponent(req, new ActionRequeueRequest(detail.entityId));
        }
    }
}