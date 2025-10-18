import { BaseSystem } from '../../core/baseSystem.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { ModalType, PartInfo, PartKeyToInfoMap, EffectType, EffectScope } from '../common/constants.js';
import { InputManager } from '../../core/InputManager.js';
import { UIManager } from './UIManager.js';
import { createModalHandlers } from './modalHandlers.js';

/**
 * @class ActionPanelSystem
 * @description UIのモーダル（アクションパネル）の表示とインタラクションを管理するシステム。
 * このシステムは、モーダルの種類に応じたロジックを`modalHandlers`に集約し、
 * 自身はそれらを呼び出すディスパッチャーとして機能します。
 */
export class ActionPanelSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.inputManager = new InputManager();
        
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
        this.focusedButtonKey = null; // SELECTIONモーダル固有の状態

        // --- Event Handlers ---
        this.boundHandlePanelClick = null;

        // モーダルハンドラの定義を外部のファクトリ関数に移譲
        this.modalHandlers = createModalHandlers(this);
        this.bindWorldEvents();

        // パネル自体は常に表示するため、内容のリセットのみを行う
        // 初期状態ではパネルの内容をリセットする
        this.hideActionPanel();
    }
    
    /**
     * このシステムが管理するDOMイベントリスナーを全て破棄します。
     */
    destroy() {
        if (this.boundHandlePanelClick) {
            this.dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
        }
    }
    
    /**
     * Worldから発行されるイベントを購読します。
     */
    bindWorldEvents() {
        this.world.on(GameEvents.SHOW_MODAL, (detail) => this.showActionPanel(detail.type, detail.data));
        this.world.on(GameEvents.HIDE_MODAL, () => this.hideActionPanel());
        // HPバーアニメーションの完了イベントを購読
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
        // onActionExecutedはMessageSystemが担当するため、このシステムでは購読しない
    }

    /**
     * 毎フレームの更新処理。主にキーボード入力を処理します。
     */
    update(deltaTime) {
        if (!this.currentHandler) return;

        // キー入力を現在のモーダルハンドラに委譲する
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
    
    /**
     * アクションパネルを表示し、指定されたタイプのモーダルを構成します。
     */
    showActionPanel(type, data) {
        this.currentHandler = this.modalHandlers[type];
        if (!this.currentHandler) {
            console.warn(`ActionPanelSystem: No handler found for modal type "${type}"`);
            this.hideActionPanel();
            return;
        }

        this.world.emit(GameEvents.GAME_PAUSED);
        this.currentModalType = type;
        this.currentModalData = data;
        
        // --- Reset Panel State ---
        this.resetPanelDOM();

        // --- Configure Panel using Handler ---
        const { dom } = this;
        const handler = this.currentHandler;
        
        // テキストコンテンツを設定
        dom.actionPanelOwner.textContent = handler.getOwnerName?.(data) || '';
        dom.actionPanelTitle.textContent = handler.getTitle?.(data) || '';
        // innerHTMLを使用して複数行メッセージに対応
        dom.actionPanelActor.innerHTML = handler.getActorName?.(data) || '';
        // getContentHTML に this(system) を渡す
        dom.actionPanelButtons.innerHTML = handler.getContentHTML?.(data, this) || '';

        // イベントリスナーを設定
        handler.setupEvents?.(this, dom.actionPanelButtons, data);

        // クリック可能かどうかの設定
        if (handler.isClickable) {
            dom.actionPanelIndicator.classList.remove('hidden');
            dom.actionPanel.classList.add('clickable');
            // イベントリスナーを一度だけバインド
            if (!this.boundHandlePanelClick) {
                // handleConfirmには現在のモーダルデータも渡す
                this.boundHandlePanelClick = () => this.currentHandler?.handleConfirm?.(this, this.currentModalData);
            }
            dom.actionPanel.addEventListener('click', this.boundHandlePanelClick);
        }

        // 初期フォーカスを設定
        handler.init?.(this, data);
    }
    
    /**
     * アクションパネルを非表示にし、関連する状態をリセットします。
     */
    hideActionPanel() {
        if (this.currentModalType) {
            this.world.emit(GameEvents.MODAL_CLOSED, { modalType: this.currentModalType });
            this.world.emit(GameEvents.GAME_RESUMED);
        }
        
        this.currentModalType = null;
        this.currentModalData = null;
        this.currentHandler = null;

        this.resetPanelDOM();
        this.resetHighlightsAndFocus();
    }

    // --- Event Handlers from World ---

    /**
     * ViewSystemからのHPバーアニメーション完了通知を受け取るハンドラ。
     * 現在のモーダルハンドラに処理を委譲します。
     */
    onHpBarAnimationCompleted() {
        if (this.currentHandler?.onHpBarAnimationCompleted) {
            this.currentHandler.onHpBarAnimationCompleted(this);
        }
    }

    // onActionExecutedは削除。責務はMessageSystemに移譲。

    // --- Helper Methods used by Handlers ---

    /**
     * パネルのDOM要素を初期状態にリセットします。
     */
    resetPanelDOM() {
        const { dom } = this;
        dom.actionPanelOwner.textContent = '';
        dom.actionPanelTitle.textContent = '';
        dom.actionPanelActor.innerHTML = '待機中...'; // innerHTML
        dom.actionPanelButtons.innerHTML = '';
        dom.actionPanelIndicator.classList.add('hidden');
        dom.actionPanel.classList.remove('clickable');
        if (this.boundHandlePanelClick) {
            dom.actionPanel.removeEventListener('click', this.boundHandlePanelClick);
            this.boundHandlePanelClick = null;
        }
    }
    
    /**
     * 全てのハイライトとフォーカスをリセットします。
     */
    resetHighlightsAndFocus() {
        const allPlayerIds = this.world.getEntitiesWith(Components.PlayerInfo);
        allPlayerIds.forEach(id => {
            const dom = this.uiManager.getDOMElements(id);
            if (dom?.iconElement) dom.iconElement.style.boxShadow = '';
        });

        if (this.focusedButtonKey) {
            const oldButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
            if (oldButton) oldButton.classList.remove('focused');
        }
        this.focusedButtonKey = null;
    }
}