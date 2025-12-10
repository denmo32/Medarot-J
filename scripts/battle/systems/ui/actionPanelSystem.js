/**
 * @file ActionPanelSystem.js
 * @description アクションパネルおよびモーダル表示を管理するシステム。
 * レンダリングロジックをBattleUIManagerへ委譲。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { InputManager } from '../../../../engine/input/InputManager.js';
import { UIManager } from '../../../../engine/ui/UIManager.js'; 
import { BattleUIManager } from '../../ui/BattleUIManager.js';
import { BattleInputController } from '../../ui/BattleInputController.js';
import { BattleUIState } from '../../components/index.js';
import { modalHandlers } from '../../ui/modalHandlers.js'; 
import { PlayerInfo } from '../../../components/index.js';
import { TaskType } from '../../tasks/BattleTasks.js';

export class ActionPanelSystem extends System {
    constructor(world) {
        super(world);
        this.engineUIManager = this.world.getSingletonComponent(UIManager);
        this.inputManager = this.world.getSingletonComponent(InputManager);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        
        this.battleUI = new BattleUIManager();
        this.handlers = modalHandlers;

        this.inputController = new BattleInputController(
            this.inputManager, 
            this.uiState, 
            this.handlers
        );

        this.currentHandler = null;
        this.boundHandlePanelClick = null;
        
        this.bindWorldEvents();
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
        if (!this.uiState.currentModalType || this.uiState.isWaitingForAnimation) return;
        this._handleInput();
    }

    _handleInput() {
        const ctx = this._createHandlerContext();
        this.inputController.handleInput(ctx);
    }

    _createHandlerContext() {
        return {
            data: this.uiState.currentModalData,
            uiState: this.uiState,
            focusedButtonKey: this.focusedButtonKey,
            
            emit: (eventName, detail) => this.world.emit(eventName, detail),
            close: () => this.hideActionPanel(),
            proceed: () => this.proceedToNextSequence(),
            
            updateTargetHighlight: (targetId, show) => {
                const targetDom = this.engineUIManager.getDOMElements(targetId);
                if (targetDom?.targetIndicatorElement) {
                    targetDom.targetIndicatorElement.classList.toggle('active', show);
                }
            },
            
            setButtonFocus: (key, focused) => {
                this.battleUI.setButtonFocus(key, focused);
                if (focused) {
                    this.focusedButtonKey = key;
                } else if (this.focusedButtonKey === key) {
                    this.focusedButtonKey = null;
                }
            },
            
            triggerButtonClick: (key) => this.battleUI.triggerButtonClick(key)
        };
    }

    onRequestTaskExecution(task) {
        if (task.type !== TaskType.DIALOG) return;
        // DialogRequestもTaskType.DIALOGとして来るが、中身はSHOW_MODALと同じような構造
        // VisualDirectorSystem が処理しているのでここでは本来受け取らないはずだが、
        // もし直接TaskRunnerが発行してきた場合のフォールバックとして残すなら以下の通り
        // ただし現状は VisualDirectorSystem が処理し、SHOW_MODALを発行している。
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
        this.currentHandler = this.handlers[type];
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
        
        // MODAL_CLOSEDイベントも発行（VisualDirectorSystemがRequestを削除するために必要）
        this.world.emit(GameEvents.MODAL_CLOSED, {
            modalType: currentModalType,
            taskId: this.uiState.currentTaskId
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
        
        this.battleUI.resetPanel();
        
        const handler = this.currentHandler;
        const displayData = { ...this.uiState.currentModalData, currentMessage: currentStep };

        const ownerName = handler.getOwnerName?.(displayData) || '';
        const title = handler.getTitle?.(displayData) || '';
        const actorName = handler.getActorName?.(displayData) || '';

        this.battleUI.updatePanelText(ownerName, title, actorName);
        
        const ctx = this._createHandlerContext();
        
        // DOM生成をBattleUIManagerへ委譲
        this.battleUI.renderContent(this.uiState.currentModalType, ctx, displayData);

        if (handler.isClickable) {
            this.battleUI.showIndicator();
            this.battleUI.setPanelClickable(true);
            
            if (!this.boundHandlePanelClick) {
                this.boundHandlePanelClick = () => {
                    const clickCtx = this._createHandlerContext();
                    handler.handleConfirm?.(clickCtx, this.uiState.currentModalData);
                };
            }
            this.battleUI.setPanelClickListener(this.boundHandlePanelClick);
        }
        
        if (handler.init) {
            handler.init(ctx, displayData);
        }
    }

    _waitForAnimation(step) {
        this.uiState.isWaitingForAnimation = true;
        this.battleUI.setPanelClickable(false);
        this.battleUI.hideIndicator();
        
        const effectsToAnimate = step.effects || this.uiState.currentModalData.appliedEffects || [];
        this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, { appliedEffects: effectsToAnimate });
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