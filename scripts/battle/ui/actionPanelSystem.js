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
        this.focusedButtonKey = null;

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
     * アニメーション完了後、パネルをクリック可能にします。
     */
    onHpBarAnimationCompleted() {
        // 現在のモーダルが結果表示の場合にのみ、処理を実行
        if (this.currentModalType === ModalType.EXECUTION_RESULT) {
            this.makePanelClickableForResult();
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

    // --- Helper methods for SELECTION modal (called from modalHandlers.js) ---
    generateTriangleLayoutHTML(buttons) {
        const headBtn = buttons.find(b => b.partKey === 'head');
        const rArmBtn = buttons.find(b => b.partKey === 'rightArm');
        const lArmBtn = buttons.find(b => b.partKey === 'leftArm');
        const renderButton = (btn) => {
            if (!btn) return '<div style="width: 100px; height: 35px;"></div>';
            return `<button id="panelBtn-${btn.partKey}" class="part-action-button" ${btn.isBroken ? 'disabled' : ''}>${btn.text}</button>`;
        };
        return `
            <div class="triangle-layout">
                <div class="top-row">${renderButton(headBtn)}</div>
                <div class="bottom-row">${renderButton(rArmBtn)}${renderButton(lArmBtn)}</div>
            </div>`;
    }

    setupSelectionEvents(container, data) {
        data.buttons.forEach(btnData => {
            if (btnData.isBroken) return;
            const buttonEl = container.querySelector(`#panelBtn-${btnData.partKey}`);
            if (!buttonEl) return;
    
            buttonEl.onclick = () => {
                const target = btnData.target;
                this.world.emit(GameEvents.PART_SELECTED, {
                    entityId: data.entityId,
                    partKey: btnData.partKey,
                    targetId: target?.targetId ?? null,
                    targetPartKey: target?.targetPartKey ?? null,
                });
                this.hideActionPanel();
            };
    
            if ([EffectScope.ENEMY_SINGLE, EffectScope.ALLY_SINGLE].includes(btnData.targetScope) && btnData.targetTiming === 'pre-move') {
                buttonEl.onmouseover = () => this._updateTargetHighlight(btnData.partKey, true);
                buttonEl.onmouseout = () => this._updateTargetHighlight(btnData.partKey, false);
            }
        });
    }

    _updateTargetHighlight(partKey, show) {
        const buttonData = this.currentModalData?.buttons.find(b => b.partKey === partKey);
        if (!buttonData || buttonData.targetTiming !== 'pre-move') return;
        const target = buttonData.target;
        if (target?.targetId !== null) {
            const targetDom = this.uiManager.getDOMElements(target.targetId);
            if (targetDom?.iconElement) {
                targetDom.iconElement.style.boxShadow = show ? '0 0 15px cyan' : '';
            }
        }
    }

    handleArrowKeyNavigation(key) {
        const availableButtons = this.currentModalData?.buttons.filter(b => !b.isBroken);
        if (!availableButtons || availableButtons.length === 0) return;
        let nextFocusKey = this.focusedButtonKey;
        const has = (partKey) => availableButtons.some(b => b.partKey === partKey);
        switch (this.focusedButtonKey) {
            case PartInfo.HEAD.key:
                if (key === 'arrowdown' || key === 'arrowleft') nextFocusKey = has(PartInfo.RIGHT_ARM.key) ? PartInfo.RIGHT_ARM.key : PartInfo.LEFT_ARM.key;
                else if (key === 'arrowright') nextFocusKey = has(PartInfo.LEFT_ARM.key) ? PartInfo.LEFT_ARM.key : PartInfo.RIGHT_ARM.key;
                break;
            case PartInfo.RIGHT_ARM.key:
                if (key === 'arrowup') nextFocusKey = has(PartInfo.HEAD.key) ? PartInfo.HEAD.key : null;
                else if (key === 'arrowright') nextFocusKey = has(PartInfo.LEFT_ARM.key) ? PartInfo.LEFT_ARM.key : null;
                break;
            case PartInfo.LEFT_ARM.key:
                if (key === 'arrowup') nextFocusKey = has(PartInfo.HEAD.key) ? PartInfo.HEAD.key : null;
                else if (key === 'arrowleft') nextFocusKey = has(PartInfo.RIGHT_ARM.key) ? PartInfo.RIGHT_ARM.key : null;
                break;
            default: nextFocusKey = availableButtons.find(b => b.partKey === PartInfo.HEAD.key)?.partKey || availableButtons[0]?.partKey;
        }
        if (nextFocusKey) this.updateFocus(nextFocusKey);
    }
    
    updateFocus(newKey) {
        if (this.focusedButtonKey === newKey) return;
        if (this.focusedButtonKey) {
            this._updateTargetHighlight(this.focusedButtonKey, false);
            const oldButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
            if (oldButton) oldButton.classList.remove('focused');
        }
        this._updateTargetHighlight(newKey, true);
        const newButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${newKey}`);
        if (newButton) {
            newButton.classList.add('focused');
            this.focusedButtonKey = newKey;
        } else {
            this.focusedButtonKey = null;
        }
    }
    
    confirmSelection() {
        if (!this.focusedButtonKey) return;
        const focusedButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
        if (focusedButton && !focusedButton.disabled) focusedButton.click();
    }

    // --- Helper for EXECUTION_RESULT modal (called from modalHandlers.js) ---

    /**
     * 結果表示モーダルのイベント設定。
     * アニメーションの責務をViewSystemに移譲し、このメソッドはイベント発行に専念します。
     * @param {HTMLElement} container - ボタンコンテナ
     * @param {object} data - モーダルデータ (ACTION_EXECUTEDのペイロード)
     */
    setupExecutionResultEvents(container, data) {
        const damageEffects = data.appliedEffects?.filter(e => e.type === EffectType.DAMAGE || e.type === EffectType.HEAL) || [];

        // アニメーションを再生する効果がない場合は、即座にクリック可能にする
        if (damageEffects.length === 0) {
            this.makePanelClickableForResult();
            return;
        }

        // ViewSystemにHPバーのアニメーション再生を要求
        this.world.emit(GameEvents.HP_BAR_ANIMATION_REQUESTED, { effects: damageEffects });

        // アニメーション完了はHP_BAR_ANIMATION_COMPLETEDイベントで検知するため、ここでは待機する。
    }

    /**
     * パネルをクリック可能にするヘルパー関数
     */
    makePanelClickableForResult() {
        // このメソッドは、アニメーション完了後 (onHpBarAnimationCompleted) または
        // アニメーションが不要な場合に呼ばれる
        if (this.currentModalType === ModalType.EXECUTION_RESULT) {
            this.dom.actionPanel.classList.add('clickable');
            this.dom.actionPanelIndicator.classList.remove('hidden');
            if (!this.boundHandlePanelClick) {
                this.boundHandlePanelClick = () => this.currentHandler?.handleConfirm?.(this, this.currentModalData);
                this.dom.actionPanel.addEventListener('click', this.boundHandlePanelClick);
            }
        }
    }

}