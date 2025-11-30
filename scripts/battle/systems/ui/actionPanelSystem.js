import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { InputManager } from '../../../../engine/input/InputManager.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { BattleUIState } from '../../components/index.js';
import { createModalHandlers } from '../../ui/modalHandlers.js';
import { PlayerInfo } from '../../../components/index.js';
import { TaskType } from '../../tasks/BattleTasks.js';

export class ActionPanelSystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.inputManager = this.world.getSingletonComponent(InputManager);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        
        this.dom = {
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelIndicator: document.getElementById('action-panel-indicator')
        };

        this.currentHandler = null;
        this.boundHandlePanelClick = null;

        this.modalHandlers = createModalHandlers(this);
        this.bindWorldEvents();
        this.hideActionPanel(); // 初期化時に非表示
    }
    
    destroy() {
        if (this.boundHandlePanelClick) {
            this.dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
        }
        super.destroy();
    }
    
    bindWorldEvents() {
        this.on(GameEvents.SHOW_MODAL, this.onShowModal.bind(this));
        this.on(GameEvents.HIDE_MODAL, this.hideActionPanel.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
        
        // MessageSystemから移行: タスク実行要求を直接処理
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
        
        // タスクからの要求としてキューに追加
        this.queueModal({
            type: task.modalType,
            data: task.data,
            messageSequence: task.messageSequence,
            taskId: task.id // タスクIDを保持
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
        
        // 状態をBattleUIStateコンポーネントにセット
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
        const { currentModalType, currentModalData, currentTaskId } = this.uiState;

        if (currentModalType === ModalType.EXECUTION_RESULT) {
            this.world.emit(GameEvents.COMBAT_RESOLUTION_DISPLAYED, {
                attackerId: currentModalData?.attackerId
            });
        }

        this.world.emit(GameEvents.MODAL_SEQUENCE_COMPLETED, {
            modalType: currentModalType,
            originalData: currentModalData,
        });

        // タスク経由の場合は完了通知を発行
        if (currentTaskId) {
            this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId: currentTaskId });
        }

        if (currentModalType === ModalType.ATTACK_DECLARATION && this.uiState.modalQueue.length > 0) {
            // 攻撃宣言などの後ですぐに次のモーダルがある場合はパネルを閉じずに次へ
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
        this.resetPanelDOM();
        
        const handler = this.currentHandler;
        const displayData = { ...this.uiState.currentModalData, currentMessage: currentStep };

        this._updatePanelText(handler, displayData);
        this._updatePanelButtons(handler, displayData);
        
        if (handler.init) {
            handler.init(this, displayData);
        }
    }

    _waitForAnimation(step) {
        this.uiState.isWaitingForAnimation = true;
        this.dom.actionPanel.classList.remove('clickable');
        this.dom.actionPanelIndicator.classList.add('hidden');
        
        const effectsToAnimate = step.effects || this.uiState.currentModalData.appliedEffects || [];
        
        this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, { appliedEffects: effectsToAnimate });
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
                this.boundHandlePanelClick = () => handler.handleConfirm?.(this, this.uiState.currentModalData);
            }
            this.dom.actionPanel.addEventListener('click', this.boundHandlePanelClick);
        }
    }
    
    hideActionPanel() {
        if (this.uiState.currentModalType) {
            this.world.emit(GameEvents.MODAL_CLOSED, { modalType: this.uiState.currentModalType });
            this.world.emit(GameEvents.GAME_RESUMED);
        }
        
        this._resetState();
        this.resetPanelDOM();
        this.resetHighlightsAndFocus();
        
        this._processModalQueue();
    }

    _resetState() {
        if (this.uiState) {
            this.uiState.reset();
        }
        this.currentHandler = null;
    }

    onHpBarAnimationCompleted(detail) {
        if (this.uiState.isWaitingForAnimation) {
            this.uiState.isWaitingForAnimation = false;
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

        if (this.uiState.focusedButtonKey) {
            const oldButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.uiState.focusedButtonKey}`);
            if (oldButton) oldButton.classList.remove('focused');
        }
        this.uiState.focusedButtonKey = null;
    }

    // ModalHandlersからアクセスするためのヘルパー (Systemインスタンス経由で呼ばれる想定)
    get focusedButtonKey() { return this.uiState.focusedButtonKey; }
    set focusedButtonKey(value) { this.uiState.focusedButtonKey = value; }
    
    get currentModalData() { return this.uiState.currentModalData; }
}