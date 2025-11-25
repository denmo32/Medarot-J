import { BaseSystem } from '../../../engine/baseSystem.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { InputManager } from '../../../engine/InputManager.js';
import { UIManager } from '../../ui/UIManager.js';
import { createModalHandlers } from '../../ui/modalHandlers.js';
import { PlayerInfo } from '../../components/index.js';

/**
 * @class ActionPanelSystem
 * @description UIのモーダル（アクションパネル）の表示とインタラクションを管理するシステム。
 */
export class ActionPanelSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        // InputManagerはシングルトンコンポーネントとしてWorldから取得
        this.inputManager = this.world.getSingletonComponent(InputManager);
        
        // --- DOM References ---
        this.dom = {
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelIndicator: document.getElementById('action-panel-indicator')
        };

        // --- State ---
        this.currentModalType = null;
        this.currentModalData = null;
        this.currentHandler = null;
        this.focusedButtonKey = null;

        // --- Queue State ---
        this.modalQueue = [];
        this.isProcessingQueue = false;
        this.currentMessageSequence = [];
        this.currentSequenceIndex = 0;
        this.isWaitingForAnimation = false;

        // --- Event Handlers ---
        this.boundHandlePanelClick = null;

        this.modalHandlers = createModalHandlers(this);
        this.bindWorldEvents();
        this.hideActionPanel();
    }
    
    destroy() {
        if (this.boundHandlePanelClick) {
            this.dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
        }
    }
    
    bindWorldEvents() {
        this.world.on(GameEvents.SHOW_MODAL, this.queueModal.bind(this));
        this.world.on(GameEvents.HIDE_MODAL, this.hideActionPanel.bind(this));
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }

    update(deltaTime) {
        // モーダルが表示されていない、またはアニメーション待機中は入力を無視
        if (!this.currentHandler || this.isWaitingForAnimation || !this.inputManager) return;

        this._handleInput();
    }

    _handleInput() {
        // ナビゲーション処理の委譲
        if (this.currentHandler.handleNavigation) {
            if (this.inputManager.wasKeyJustPressed('ArrowUp')) this.currentHandler.handleNavigation(this, 'arrowup');
            if (this.inputManager.wasKeyJustPressed('ArrowDown')) this.currentHandler.handleNavigation(this, 'arrowdown');
            if (this.inputManager.wasKeyJustPressed('ArrowLeft')) this.currentHandler.handleNavigation(this, 'arrowleft');
            if (this.inputManager.wasKeyJustPressed('ArrowRight')) this.currentHandler.handleNavigation(this, 'arrowright');
        }
        // 決定・キャンセル処理の委譲
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
        
        // メッセージシーケンスの初期化
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

        // ATTACK_DECLARATIONの場合は次にEXECUTION_RESULTが控えている可能性があるため、
        // hideActionPanelを呼ばずに次のキュー処理へ移行する
        if (this.currentModalType === ModalType.ATTACK_DECLARATION && this.modalQueue.length > 0) {
            this.isProcessingQueue = false;
            this._processModalQueue();
        } else {
            this.hideActionPanel();
        }
    }

    _displayCurrentSequenceStep() {
        const currentStep = this.currentMessageSequence[this.currentSequenceIndex] || {};
        
        // アニメーション待機ステップの場合
        if (currentStep.waitForAnimation) {
            this._waitForAnimation(currentStep);
            return;
        }
        
        this.isWaitingForAnimation = false;
        this.resetPanelDOM(); // 表示のリセット
        
        // ハンドラを使用してコンテンツを構築
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
        
        // コンテンツ生成（elユーティリティで作られたDOM要素が返ることを期待）
        if (typeof handler.createContent === 'function') {
            const contentElement = handler.createContent(this, displayData);
            if (contentElement instanceof HTMLElement) {
                this.dom.actionPanelButtons.appendChild(contentElement);
            }
        }

        // クリック制御の設定
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
        
        // 次のキューがあれば処理
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
        const allPlayerIds = this.world.getEntitiesWith(PlayerInfo);
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