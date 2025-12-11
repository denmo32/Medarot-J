/**
 * @file ModalSystem.js
 * @description モーダルの状態管理とフロー制御、入力への応答を担当するシステム。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattleUIState } from '../../components/index.js';
import { modalHandlers } from '../../ui/modalHandlers.js';
import { PlayerInfo } from '../../../components/index.js';
import { ModalType } from '../../common/constants.js'; 
import { ActionService } from '../../services/ActionService.js'; // インポートを追加

export class ModalSystem extends System {
    constructor(world) {
        super(world);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        this.handlers = modalHandlers;

        this.bindEvents();
    }

    bindEvents() {
        this.on(GameEvents.SHOW_MODAL, this.onShowModal.bind(this));
        this.on(GameEvents.HIDE_MODAL, this.hideCurrentModal.bind(this));
        this.on(GameEvents.UI_NAVIGATE, this.onNavigate.bind(this));
        this.on(GameEvents.UI_CONFIRM, this.onConfirm.bind(this));
        this.on(GameEvents.UI_CANCEL, this.onCancel.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onAnimationCompleted.bind(this));
        this.on(GameEvents.PLAYER_INPUT_REQUIRED, this.onPlayerInputRequired.bind(this));
        this.on(GameEvents.PART_SELECTED, this.onPartSelected.bind(this)); // リッスンを追加
    }

    update(deltaTime) {
        // キューの処理
        if (!this.uiState.isProcessingQueue && this.uiState.modalQueue.length > 0) {
            this._processModalQueue();
        }
    }

    onShowModal(detail) {
        this.uiState.modalQueue.push(detail);
    }

    _processModalQueue() {
        if (this.uiState.modalQueue.length === 0) {
            this.uiState.isProcessingQueue = false;
            return;
        }

        this.uiState.isProcessingQueue = true;
        const modalRequest = this.uiState.modalQueue.shift();
        
        this.uiState.currentModalType = modalRequest.type;
        this.uiState.currentModalData = modalRequest.data;
        this.uiState.currentTaskId = modalRequest.taskId || null;
        this.uiState.currentModalCallback = modalRequest.onComplete || null;
        this.uiState.currentMessageSequence = modalRequest.messageSequence || [{}];
        this.uiState.currentSequenceIndex = 0;

        this.world.emit(GameEvents.GAME_PAUSED);
        this.displayCurrentSequenceStep();
    }

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

        // 描画用データをuiStateに設定
        const displayData = { ...this.uiState.currentModalData, currentMessage: currentStep };
        this.uiState.ownerText = handler.getOwnerName?.(displayData) || '';
        this.uiState.titleText = handler.getTitle?.(displayData) || '';
        this.uiState.actorText = handler.getActorName?.(displayData) || displayData.currentMessage?.text || '';
        this.uiState.buttonsData = this.uiState.currentModalData?.buttons || [];
        this.uiState.isPanelVisible = true;
        this.uiState.isPanelClickable = !!handler.isClickable;

        // 初期化処理があれば実行
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
        // resetはUIの状態のみをリセットし、キューは維持する
        this.uiState.reset();
        this.world.emit(GameEvents.UI_STATE_CHANGED);
        // キューの次の処理へ
        this.uiState.isProcessingQueue = false;
    }

    onNavigate({ direction }) {
        this._handleUserInput('handleNavigation', direction);
    }
    onConfirm() {
        this._handleUserInput('handleConfirm');
    }
    onCancel() {
        this._handleUserInput('handleCancel');
    }

    _handleUserInput(handlerName, ...args) {
        if (!this.uiState.currentModalType || this.uiState.isWaitingForAnimation) return;
        
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
            case 'EMIT':
                this.world.emit(action.eventName, action.detail);
                break;
            case 'CLOSE_MODAL':
                this.hideCurrentModal();
                break;
            case 'EMIT_AND_CLOSE':
                this.world.emit(action.eventName, action.detail);
                this.hideCurrentModal();
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

    onAnimationCompleted() {
        if (this.uiState.isWaitingForAnimation) {
            this.uiState.isWaitingForAnimation = false;
            this.proceedToNextSequence();
        }
    }
    
    onPlayerInputRequired(detail) {
        const handler = this.handlers[ModalType.SELECTION];
        if (!handler || !handler.prepareData) {
            console.error('SELECTION modal handler or prepareData function is not defined.');
            return;
        }
        
        const modalData = handler.prepareData({ world: this.world, data: detail });

        if (modalData) {
            this.onShowModal({ 
                type: ModalType.SELECTION, 
                data: modalData,
                immediate: true
            });
        } else {
            // データ準備に失敗した場合（ターゲットがいないなど）
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId: detail.entityId });
        }
    }

    // InputSystemから処理を移譲
    onPartSelected(detail) {
        const { entityId, partKey, target } = detail;
        ActionService.decideAndEmit(this.world, entityId, partKey, target);
    }
}