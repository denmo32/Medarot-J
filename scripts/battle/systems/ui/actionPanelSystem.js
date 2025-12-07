/**
 * @file ActionPanelSystem.js
 * @description アクションパネルおよびモーダル表示を管理するシステム。
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
        // エンジンのUIManager (エンティティとDOMの紐付け用)
        this.engineUIManager = this.world.getSingletonComponent(UIManager);
        
        this.inputManager = this.world.getSingletonComponent(InputManager);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
        
        // バトル専用UIマネージャ (パネル操作用)
        this.battleUI = new BattleUIManager();

        // モーダルハンドラ定義への参照
        this.handlers = modalHandlers;

        // 入力コントローラー (入力判定ロジックの分離)
        this.inputController = new BattleInputController(
            this.inputManager, 
            this.uiState, 
            this.handlers
        );

        this.currentHandler = null;
        this.boundHandlePanelClick = null;
        
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
        // モーダルが表示されていない、またはアニメーション待機中の場合は入力を受け付けない
        if (!this.uiState.currentModalType || this.uiState.isWaitingForAnimation) return;
        
        this._handleInput();
    }

    _handleInput() {
        const ctx = this._createHandlerContext();
        this.inputController.handleInput(ctx);
    }

    /**
     * ハンドラに渡すコンテキストオブジェクトを生成する
     * @returns {object} ModalHandlerContext
     */
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
        
        const ctx = this._createHandlerContext();
        this._updatePanelButtons(handler, ctx, displayData);
        
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

    _updatePanelButtons(handler, ctx, displayData) {
        this.battleUI.clearButtons();
        
        if (typeof handler.createContent === 'function') {
            const contentElement = handler.createContent(ctx, displayData);
            if (contentElement instanceof HTMLElement) {
                this.battleUI.addButtonContent(contentElement);
            }
        }

        if (handler.isClickable) {
            this.battleUI.showIndicator();
            this.battleUI.setPanelClickable(true);
            
            if (!this.boundHandlePanelClick) {
                // コンテキストを都度生成するため、クロージャ内でその時点のctxを使用するか、
                // click発生時に再生成するか検討が必要。
                // ここではシンプルに、click発生時に_handleInput同様に処理を委譲する形をとるか、
                // ハンドラ実行用のヘルパーを呼ぶ。
                this.boundHandlePanelClick = () => {
                    // クリックイベント発生時点のコンテキストで実行
                    const clickCtx = this._createHandlerContext();
                    handler.handleConfirm?.(clickCtx, this.uiState.currentModalData);
                };
            }
            // リスナーを再設定（同じ関数インスタンスなら重複しないが、念のためresetPanelで解除済み）
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