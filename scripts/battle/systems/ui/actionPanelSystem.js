/**
 * @file ActionPanelSystem.js
 * @description アクションパネルおよびモーダル表示を管理するシステム。
 * DOM操作はBattleUIManagerに委譲し、入力処理と状態遷移に集中する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { InputManager } from '../../../../engine/input/InputManager.js';
import { UIManager } from '../../../../engine/ui/UIManager.js'; // エンジンのUIManager
import { BattleUIManager } from '../../ui/BattleUIManager.js'; // 新規作成したUIマネージャ
import { BattleUIState } from '../../components/index.js';
import { createModalHandlers } from '../../ui/modalHandlers.js';
import { PlayerInfo } from '../../../components/index.js';
import { TaskType } from '../../tasks/BattleTasks.js';

export class ActionPanelSystem extends System {
    constructor(world) {
        super(world);
        // エンジンのUIManager (エンティティとDOMの紐付け用)
        this.engineUIManager = this.world.getSingletonComponent(UIManager);
        
        this.inputManager = this.world.getSingletonComponent(InputManager);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        
        // バトル専用UIマネージャ (パネル操作用)
        this.battleUI = new BattleUIManager();

        this.currentHandler = null;
        this.boundHandlePanelClick = null;

        this.modalHandlers = createModalHandlers(this);
        this.bindWorldEvents();
        
        // 初期化時にパネルを非表示
        this.hideActionPanel();
    }
    
    destroy() {
        this.battleUI.removePanelClickListener(this.boundHandlePanelClick);
        super.destroy();
    }
    
    bindWorldEvents() {
        this.on(GameEvents.SHOW_MODAL, this.onShowModal.bind(this));
        this.on(GameEvents.HIDE_MODAL, this.hideActionPanel.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
        this.on(GameEvents.REQUEST_TASK_EXECUTION, this.onRequestTaskExecution.bind(this));
    }

    update(deltaTime) {
        if (!this.currentHandler || this.uiState.isWaitingForAnimation || !this.inputManager) return;
        this._handleInput();
    }

    _handleInput() {
        if (this.currentHandler.handleNavigation) {
            const navKeys = [
                { key: 'ArrowUp', direction: 'arrowup' },
                { key: 'ArrowDown', direction: 'arrowdown' },
                { key: 'ArrowLeft', direction: 'arrowleft' },
                { key: 'ArrowRight', direction: 'arrowright' }
            ];

            for (const { key, direction } of navKeys) {
                if (this.inputManager.wasKeyJustPressed(key)) {
                    this.currentHandler.handleNavigation(this, direction);
                }
            }
        }
        if (this.inputManager.wasKeyJustPressed('z')) {
            this.currentHandler.handleConfirm?.(this, this.uiState.currentModalData);
        }
        if (this.inputManager.wasKeyJustPressed('x')) {
            this.currentHandler.handleCancel?.(this, this.uiState.currentModalData);
        }
    }

    onRequestTaskExecution(task) {
        if (task.type !== TaskType.MESSAGE) return;
        
        this.queueModal({
            type: task.modalType,
            data: task.data,
            messageSequence: task.messageSequence,
            taskId: task.id,
            onComplete: task.onComplete
        });
    }

    onShowModal(detail) {
        this.queueModal(detail);
    }

    queueModal(detail) {
        this.uiState.modalQueue.push(detail);
        if (!this.uiState.isProcessingQueue) {
            this._processModalQueue();
        }
    }
    
    _processModalQueue() {
        if (this.uiState.modalQueue.length > 0) {
            this.uiState.isProcessingQueue = true;
            const modalRequest = this.uiState.modalQueue.shift();
            this.uiState.currentModalCallback = modalRequest.onComplete || null;
            this._showModal(modalRequest);
        } else {
            this.uiState.isProcessingQueue = false;
        }
    }
    
    _showModal({ type, data, messageSequence = [], taskId = null }) {
        this.currentHandler = this.modalHandlers[type];
        if (!this.currentHandler) {
            console.warn(`ActionPanelSystem: No handler found for modal type "${type}"`);
            this.uiState.isProcessingQueue = false;
            this._processModalQueue();
            return;
        }

        this.world.emit(GameEvents.GAME_PAUSED);
        
        this.uiState.currentModalType = type;
        this.uiState.currentModalData = data;
        this.uiState.currentTaskId = taskId;
        this.uiState.currentMessageSequence = (messageSequence.length > 0) ? messageSequence : [{}];
        this.uiState.currentSequenceIndex = 0;
        
        this._displayCurrentSequenceStep();
    }
    
    proceedToNextSequence() {
        if (this.uiState.isWaitingForAnimation) return;

        this.uiState.currentSequenceIndex++;
        if (this.uiState.currentSequenceIndex < this.uiState.currentMessageSequence.length) {
            this._displayCurrentSequenceStep();
        } else {
            this._finishCurrentModal();
        }
    }

    _finishCurrentModal() {
        const { currentModalType, currentModalData, currentModalCallback } = this.uiState;

        if (currentModalType === ModalType.EXECUTION_RESULT) {
            this.world.emit(GameEvents.COMBAT_RESOLUTION_DISPLAYED, {
                attackerId: currentModalData?.attackerId
            });
        }

        this.world.emit(GameEvents.MODAL_SEQUENCE_COMPLETED, {
            modalType: currentModalType,
            originalData: currentModalData,
        });

        if (typeof currentModalCallback === 'function') {
            currentModalCallback();
        }

        if (currentModalType === ModalType.ATTACK_DECLARATION && this.uiState.modalQueue.length > 0) {
            this.uiState.isProcessingQueue = false;
            this._processModalQueue();
        } else {
            this.hideActionPanel();
        }
    }

    _displayCurrentSequenceStep() {
        const currentStep = this.uiState.currentMessageSequence[this.uiState.currentSequenceIndex] || {};
        
        if (currentStep.waitForAnimation) {
            this._waitForAnimation(currentStep);
            return;
        }
        
        this.uiState.isWaitingForAnimation = false;
        
        // UI更新はBattleUIManagerに委譲
        this.battleUI.resetPanel();
        
        const handler = this.currentHandler;
        const displayData = { ...this.uiState.currentModalData, currentMessage: currentStep };

        const ownerName = handler.getOwnerName?.(displayData) || '';
        const title = handler.getTitle?.(displayData) || '';
        const actorName = handler.getActorName?.(displayData) || '';

        this.battleUI.updatePanelText(ownerName, title, actorName);
        
        this._updatePanelButtons(handler, displayData);
        
        if (handler.init) {
            handler.init(this, displayData);
        }
    }

    _waitForAnimation(step) {
        this.uiState.isWaitingForAnimation = true;
        this.battleUI.setPanelClickable(false);
        this.battleUI.hideIndicator();
        
        const effectsToAnimate = step.effects || this.uiState.currentModalData.appliedEffects || [];
        this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, { appliedEffects: effectsToAnimate });
    }

    _updatePanelButtons(handler, displayData) {
        this.battleUI.clearButtons();
        
        if (typeof handler.createContent === 'function') {
            const contentElement = handler.createContent(this, displayData);
            if (contentElement instanceof HTMLElement) {
                this.battleUI.addButtonContent(contentElement);
            }
        }

        if (handler.isClickable) {
            this.battleUI.showIndicator();
            this.battleUI.setPanelClickable(true);
            
            if (!this.boundHandlePanelClick) {
                this.boundHandlePanelClick = () => handler.handleConfirm?.(this, this.uiState.currentModalData);
            }
            this.battleUI.setPanelClickListener(this.boundHandlePanelClick);
        }
    }
    
    hideActionPanel() {
        if (this.uiState.currentModalType) {
            this.world.emit(GameEvents.MODAL_CLOSED, { modalType: this.uiState.currentModalType });
            this.world.emit(GameEvents.GAME_RESUMED);
        }
        
        this._resetState();
        this.battleUI.resetPanel();
        this.resetHighlightsAndFocus();
        
        this._processModalQueue();
    }

    _resetState() {
        if (this.uiState) {
            this.uiState.reset();
            this.uiState.currentModalCallback = null;
        }
        this.currentHandler = null;
    }

    onHpBarAnimationCompleted(detail) {
        if (this.uiState.isWaitingForAnimation) {
            this.uiState.isWaitingForAnimation = false;
            this.proceedToNextSequence();
        }
    }
    
    resetHighlightsAndFocus() {
        const allPlayerIds = this.getEntities(PlayerInfo);
        allPlayerIds.forEach(id => {
            const dom = this.engineUIManager.getDOMElements(id);
            if (dom?.targetIndicatorElement) dom.targetIndicatorElement.classList.remove('active');
        });

        if (this.uiState.focusedButtonKey) {
            this.battleUI.setButtonFocus(this.uiState.focusedButtonKey, false);
        }
        this.uiState.focusedButtonKey = null;
    }

    get focusedButtonKey() { return this.uiState.focusedButtonKey; }
    set focusedButtonKey(value) { this.uiState.focusedButtonKey = value; }
    
    get currentModalData() { return this.uiState.currentModalData; }
}