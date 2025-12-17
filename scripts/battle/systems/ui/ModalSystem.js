/**
 * @file ModalSystem.js
 * @description モーダルの状態管理とフロー制御を行うシステム。
 * 内部状態(currentModalEntityId)を排除し、BattleUIStateコンポーネントを使用。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleUIState } from '../../components/index.js';
import { modalHandlers } from '../../ui/modalHandlers.js';
import { ModalType } from '../../common/constants.js';
import { AiDecisionService } from '../../services/AiDecisionService.js';
import { ActionService } from '../../services/ActionService.js';
import { ModalState, PlayerInputState, ActionRequeueState, AnimationState, UIStateUpdateState, UIInputState } from '../../components/States.js';
import {
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
        // ステートレス: currentModalEntityId は削除
    }

    update(deltaTime) {
        // 1. モーダル状態の処理
        this._processModalStates();

        // 2. プレイヤー入力状態の処理
        this._processPlayerInputStates();

        // 3. モーダルキューの処理 (表示開始)
        if (!this.uiState.isProcessingQueue && this.uiState.modalQueue.length > 0) {
            this._startNextModalInQueue();
        }

        // 4. UI状態更新状態の処理 (アニメーション完了など)
        this._processStateUpdateStates();

        // 5. ユーザー入力状態の処理
        this._processInputStates();
    }

    // --- Request Processing ---

    _processModalStates() {
        const entities = this.getEntities(ModalState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, ModalState);
            if (state.isNew) {
                this.uiState.modalQueue.push({
                    type: state.type,
                    data: state.data,
                    messageSequence: state.messageSequence,
                    taskId: state.taskId,
                    onComplete: state.onComplete,
                    priority: state.priority,
                    entityId: entityId // キューにエンティティIDを保持
                });
                state.isNew = false;
                state.isOpen = true;
                // activeModalEntityId は _startNextModalInQueue で設定
            }
        }
    }
    
    _processPlayerInputStates() {
        const entities = this.getEntities(PlayerInputState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, PlayerInputState);
            if (state.isActive) {
                const handler = this.handlers[ModalType.SELECTION];
                if (handler && handler.prepareData) {
                    const modalData = handler.prepareData({
                        world: this.world,
                        data: { entityId: state.entityId },
                        services: { aiService: AiDecisionService }
                    });

                    if (modalData) {
                        const modalStateEntity = this.world.createEntity();
                        const modalState = new ModalState();
                        modalState.type = ModalType.SELECTION;
                        modalState.data = modalData;
                        modalState.priority = 'high';
                        this.world.addComponent(modalStateEntity, modalState);
                    } else {
                        const stateEntity = this.world.createEntity();
                        const actionRequeueState = new ActionRequeueState();
                        actionRequeueState.isActive = true;
                        actionRequeueState.entityId = state.entityId;
                        this.world.addComponent(stateEntity, actionRequeueState);
                    }
                }
                state.isActive = false;
            }
        }
    }

    _processStateUpdateStates() {
        const entities = this.getEntities(UIStateUpdateState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, UIStateUpdateState);
            if (state.type === 'ANIMATION_COMPLETED' && this.uiState.isWaitingForAnimation) {
                this.uiState.isWaitingForAnimation = false;
                this.proceedToNextSequence();
                state.isCompleted = true;
            }
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
        this.uiState.activeModalEntityId = modalContext.entityId || null; // コンポーネントでID管理

        if (this.getEntities(PauseState).length === 0) {
            const pauseEntity = this.world.createEntity();
            this.world.addComponent(pauseEntity, new PauseState());
        }

        this.displayCurrentSequenceStep();
    }

    // --- Input Processing ---

    _processInputStates() {
        if (!this.uiState.isPanelVisible || this.uiState.isWaitingForAnimation) {
            const entities = this.getEntities(UIInputState);
            for (const id of entities) {
                const state = this.world.getComponent(id, UIInputState);
                state.isActive = false;
            }
            return;
        }

        const entities = this.getEntities(UIInputState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, UIInputState);
            if (state.isActive) {
                switch (state.type) {
                    case 'NAVIGATE':
                        this._handleUserInput('handleNavigation', state.data.direction);
                        break;
                    case 'CONFIRM':
                        this._handleUserInput('handleConfirm');
                        break;
                    case 'CANCEL':
                        this._handleUserInput('handleCancel');
                        break;
                }
                state.isActive = false;
            }
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
            
            const stateEntity = this.world.createEntity();
            const animationState = new AnimationState();
            animationState.type = 'HP_BAR';
            animationState.data = {
                appliedEffects: currentStep.effects || this.uiState.currentModalData.appliedEffects || []
            };
            this.world.addComponent(stateEntity, animationState);
            return;
        }
        this.uiState.isWaitingForAnimation = false;

        const displayData = { ...this.uiState.currentModalData, currentMessage: currentStep };
        this.uiState.ownerText = handler.getOwnerName?.(displayData) || '';
        this.uiState.titleText = handler.getTitle?.(displayData) || '';
        this.uiState.actorText = handler.getActorName?.(displayData) || displayData.currentMessage?.text || '';
        this.uiState.buttonsData = this.uiState.currentModalData?.buttons || [];
        this.uiState.isPanelVisible = true;
        this.uiState.isPanelClickable = !!handler.isClickable;

        if (handler.init) {
            const action = handler.init({ data: this.uiState.currentModalData, uiState: this.uiState });
            this._executeAction(action);
        }
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

        // BattleUIStateに保持したIDを使用してコンポーネントを更新
        if (this.uiState.activeModalEntityId) {
            const state = this.world.getComponent(this.uiState.activeModalEntityId, ModalState);
            if (state) {
                state.isCompleted = true;
            }
        }

        this.hideCurrentModal();
    }

    hideCurrentModal() {
        if (this.uiState.isPanelVisible) {
            const pauseEntities = this.getEntities(PauseState);
            for (const id of pauseEntities) this.world.destroyEntity(id);
        }
        this._resetUIState();
        this.uiState.isProcessingQueue = false;
    }

    _resetUIState() {
        this.uiState.isProcessingQueue = false;
        this.uiState.isWaitingForAnimation = false;
        this.uiState.activeModalEntityId = null;
        this.uiState.currentModalType = null;
        this.uiState.currentModalData = null;
        this.uiState.currentTaskId = null;
        this.uiState.currentModalCallback = null;
        this.uiState.focusedButtonKey = null;
        this.uiState.currentMessageSequence = [];
        this.uiState.currentSequenceIndex = 0;
        this.uiState.ownerText = '';
        this.uiState.titleText = '';
        this.uiState.actorText = '';
        this.uiState.buttonsData = [];
        this.uiState.isPanelVisible = false;
        this.uiState.isPanelClickable = false;
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