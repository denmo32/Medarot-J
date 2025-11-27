import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { InputManager } from '../../../../engine/input/InputManager.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { createModalHandlers } from '../../ui/modalHandlers.js';
import { PlayerInfo } from '../../../components/index.js';

export class ActionPanelSystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.inputManager = this.world.getSingletonComponent(InputManager);
        
        this.dom = {
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelIndicator: document.getElementById('action-panel-indicator')
        };

        this.currentModalType = null;
        this.currentModalData = null;
        this.currentHandler = null;
        this.focusedButtonKey = null;

        this.modalQueue = [];
        this.isProcessingQueue = false;
        this.currentMessageSequence = [];
        this.currentSequenceIndex = 0;
        this.isWaitingForAnimation = false;

        this.boundHandlePanelClick = null;

        this.modalHandlers = createModalHandlers(this);
        this.bindWorldEvents();
        this.hideActionPanel();
    }
    
    destroy() {
        if (this.boundHandlePanelClick) {
            this.dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
        }
        super.destroy();
    }
    
    bindWorldEvents() {
        this.on(GameEvents.SHOW_MODAL, this.queueModal.bind(this));
        this.on(GameEvents.HIDE_MODAL, this.hideActionPanel.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }

    update(deltaTime) {
        if (!this.currentHandler || this.isWaitingForAnimation || !this.inputManager) return;
        this._handleInput();
    }

    _handleInput() {
        if (this.currentHandler.handleNavigation) {
            if (this.inputManager.wasKeyJustPressed('ArrowUp')) this.currentHandler.handleNavigation(this, 'arrowup');
            if (this.inputManager.wasKeyJustPressed('ArrowDown')) this.currentHandler.handleNavigation(this, 'arrowdown');
            if (this.inputManager.wasKeyJustPressed('ArrowLeft')) this.currentHandler.handleNavigation(this, 'arrowleft');
            if (this.inputManager.wasKeyJustPressed('ArrowRight')) this.currentHandler.handleNavigation(this, 'arrowright');
        }
        if (this.inputManager.wasKeyJustPressed('z')) {
            this.currentHandler.handleConfirm?.(this, this.currentModalData);
        }
        if (this.inputManager.wasKeyJustPressed('x')) {
            this.currentHandler.handleCancel?.(this, this.currentModalData);
        }
    }

    queueModal(detail) {
        this.modalQueue.push(detail);
        if (!this.isProcessingQueue) {
            this._processModalQueue();
        }
    }
    
    _processModalQueue() {
        if (this.modalQueue.length > 0) {
            this.isProcessingQueue = true;
            const modalRequest = this.modalQueue.shift();
            this._showModal(modalRequest);
        } else {
            this.isProcessingQueue = false;
        }
    }
    
    _showModal({ type, data, messageSequence = [] }) {
        this.currentHandler = this.modalHandlers[type];
        if (!this.currentHandler) {
            console.warn(`ActionPanelSystem: No handler found for modal type "${type}"`);
            this.isProcessingQueue = false;
            this._processModalQueue();
            return;
        }

        this.world.emit(GameEvents.GAME_PAUSED);
        this.currentModalType = type;
        this.currentModalData = data;
        
        this.currentMessageSequence = (messageSequence.length > 0) ? messageSequence : [{}];
        this.currentSequenceIndex = 0;
        
        this._displayCurrentSequenceStep();
    }
    
    proceedToNextSequence() {
        if (this.isWaitingForAnimation) return;

        this.currentSequenceIndex++;
        if (this.currentSequenceIndex < this.currentMessageSequence.length) {
            this._displayCurrentSequenceStep();
        } else {
            this._finishCurrentModal();
        }
    }

    _finishCurrentModal() {
        if (this.currentModalType === ModalType.EXECUTION_RESULT) {
            this.world.emit(GameEvents.COMBAT_RESOLUTION_DISPLAYED, {
                attackerId: this.currentModalData?.attackerId
            });
        }

        this.world.emit(GameEvents.MODAL_SEQUENCE_COMPLETED, {
            modalType: this.currentModalType,
            originalData: this.currentModalData,
        });

        if (this.currentModalType === ModalType.ATTACK_DECLARATION && this.modalQueue.length > 0) {
            this.isProcessingQueue = false;
            this._processModalQueue();
        } else {
            this.hideActionPanel();
        }
    }

    _displayCurrentSequenceStep() {
        const currentStep = this.currentMessageSequence[this.currentSequenceIndex] || {};
        
        if (currentStep.waitForAnimation) {
            this._waitForAnimation(currentStep);
            return;
        }
        
        this.isWaitingForAnimation = false;
        this.resetPanelDOM();
        
        const handler = this.currentHandler;
        const displayData = { ...this.currentModalData, currentMessage: currentStep };

        this._updatePanelText(handler, displayData);
        this._updatePanelButtons(handler, displayData);
        
        if (handler.init) {
            handler.init(this, displayData);
        }
    }

    _waitForAnimation(step) {
        this.isWaitingForAnimation = true;
        this.dom.actionPanel.classList.remove('clickable');
        this.dom.actionPanelIndicator.classList.add('hidden');
        this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, { effects: this.currentModalData.appliedEffects || [] });
    }

    _updatePanelText(handler, displayData) {
        this.dom.actionPanelOwner.textContent = handler.getOwnerName?.(displayData) || '';
        this.dom.actionPanelTitle.textContent = handler.getTitle?.(displayData) || '';
        this.dom.actionPanelActor.innerHTML = handler.getActorName?.(displayData) || '';
    }

    _updatePanelButtons(handler, displayData) {
        this.dom.actionPanelButtons.innerHTML = '';
        
        if (typeof handler.createContent === 'function') {
            const contentElement = handler.createContent(this, displayData);
            if (contentElement instanceof HTMLElement) {
                this.dom.actionPanelButtons.appendChild(contentElement);
            }
        }

        if (handler.isClickable) {
            this.dom.actionPanelIndicator.classList.remove('hidden');
            this.dom.actionPanel.classList.add('clickable');
            
            if (!this.boundHandlePanelClick) {
                this.boundHandlePanelClick = () => handler.handleConfirm?.(this, this.currentModalData);
            }
            this.dom.actionPanel.addEventListener('click', this.boundHandlePanelClick);
        }
    }
    
    hideActionPanel() {
        if (this.currentModalType) {
            this.world.emit(GameEvents.MODAL_CLOSED, { modalType: this.currentModalType });
            this.world.emit(GameEvents.GAME_RESUMED);
        }
        
        this._resetState();
        this.resetPanelDOM();
        this.resetHighlightsAndFocus();
        
        this._processModalQueue();
    }

    _resetState() {
        this.currentModalType = null;
        this.currentModalData = null;
        this.currentHandler = null;
        this.currentMessageSequence = [];
        this.currentSequenceIndex = 0;
        this.isWaitingForAnimation = false;
        this.isProcessingQueue = false;
    }

    onHpBarAnimationCompleted(detail) {
        if (this.isWaitingForAnimation) {
            this.isWaitingForAnimation = false;
            this.proceedToNextSequence();
        }
    }

    resetPanelDOM() {
        const { dom } = this;
        dom.actionPanelOwner.textContent = '';
        dom.actionPanelTitle.textContent = '';
        dom.actionPanelActor.innerHTML = '待機中...';
        dom.actionPanelButtons.innerHTML = '';
        dom.actionPanelIndicator.classList.add('hidden');
        dom.actionPanel.classList.remove('clickable');
        
        if (this.boundHandlePanelClick) {
            dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
            this.boundHandlePanelClick = null;
        }
    }
    
    resetHighlightsAndFocus() {
        const allPlayerIds = this.getEntities(PlayerInfo);
        allPlayerIds.forEach(id => {
            const dom = this.uiManager.getDOMElements(id);
            if (dom?.targetIndicatorElement) dom.targetIndicatorElement.classList.remove('active');
        });

        if (this.focusedButtonKey) {
            const oldButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
            if (oldButton) oldButton.classList.remove('focused');
        }
        this.focusedButtonKey = null;
    }
}