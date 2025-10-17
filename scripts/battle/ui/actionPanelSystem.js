import { BaseSystem } from '../../core/baseSystem.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { ModalType, PartInfo, PartKeyToInfoMap, EffectType, EffectScope } from '../common/constants.js';
import { InputManager } from '../../core/InputManager.js';
import { UIManager } from './UIManager.js';
// ★新規: モーダルハンドラの定義を外部ファイルからインポート
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

        // ★リファクタリング: モーダルハンドラの定義を外部のファクトリ関数に移譲
        this.modalHandlers = createModalHandlers(this);
        this.bindWorldEvents();

        // ★修正: パネル自体は常に表示するため、内容のリセットのみを行う
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
        this.world.on(GameEvents.ACTION_EXECUTED, (detail) => this.onActionExecuted(detail));
    }

    /**
     * 毎フレームの更新処理。主にキーボード入力を処理します。
     */
    update(deltaTime) {
        if (!this.currentHandler) return;

        // ★リファクタリング: キー入力を現在のモーダルハンドラに委譲する
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
        dom.actionPanelActor.textContent = handler.getActorName?.(data) || '';
        // ★修正: getContentHTML に this(system) を渡す
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
     * 行動実行結果を受け取り、結果表示モーダルを表示します。
     */
    onActionExecuted(detail) {
        // ★リファクタリング: メッセージ生成はハンドラに任せる。ここではイベント詳細をそのまま渡す。
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION_RESULT,
            data: detail,
            immediate: true
        });
    }

    // --- Helper Methods used by Handlers ---

    /**
     * パネルのDOM要素を初期状態にリセットします。
     */
    resetPanelDOM() {
        const { dom } = this;
        dom.actionPanelOwner.textContent = '';
        dom.actionPanelTitle.textContent = '';
        dom.actionPanelActor.textContent = '待機中...';
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

    /**
     * ★廃止: メッセージ生成は modalHandlers に移管されました。
     */
    // _generateResultMessage(detail) { ... }

    /**
     * ★廃止: 全てのモーダルタイプごとの振る舞いは `ui/modalHandlers.js` に移管されました。
     * これにより、このクラスはモーダルの「管理」に集中でき、可読性と保守性が向上します。
     */
    // setupModalHandlers() { ... }


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
    setupExecutionResultEvents(container, data) {
        const showClickable = () => {
            if (this.currentModalType === ModalType.EXECUTION_RESULT) {
                this.dom.actionPanel.classList.add('clickable');
                this.dom.actionPanelIndicator.classList.remove('hidden');
                if (!this.boundHandlePanelClick) {
                    this.boundHandlePanelClick = () => this.currentHandler?.handleConfirm?.(this, this.currentModalData);
                    this.dom.actionPanel.addEventListener('click', this.boundHandlePanelClick);
                }
            }
        };

        const damageEffect = data.resolvedEffects.find(e => e.type === EffectType.DAMAGE || e.type === EffectType.HEAL);
        if (!damageEffect || damageEffect.value === 0) {
            showClickable();
            return;
        }

        const { targetId, partKey, value } = damageEffect;
        const targetDom = this.uiManager.getDOMElements(targetId);
        const hpBar = targetDom?.partDOMElements[partKey]?.bar;
        const targetPart = this.world.getComponent(targetId, Components.Parts)?.[partKey];
        if (!hpBar || !targetPart) {
            showClickable();
            return;
        }

        const cleanup = () => {
            hpBar.style.transition = '';
            hpBar.removeEventListener('transitionend', onTransitionEnd);
            clearTimeout(fallback);
            showClickable();
        };

        const onTransitionEnd = (event) => {
            if (event.propertyName === 'width') {
                cleanup();
            }
        };
        const fallback = setTimeout(cleanup, 1000); // アニメーション失敗時のフォールバック
        
        hpBar.addEventListener('transitionend', onTransitionEnd);

        // 1. アニメーション前のHPを計算
        const finalHp = targetPart.hp;
        const changeAmount = value;
        const initialHp = (damageEffect.type === EffectType.HEAL)
            ? Math.max(0, finalHp - changeAmount)
            : Math.min(targetPart.maxHp, finalHp + changeAmount);
        const initialHpPercentage = (initialHp / targetPart.maxHp) * 100;
        const finalHpPercentage = (finalHp / targetPart.maxHp) * 100;

        // 2. 次のフレームでアニメーションを開始
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                hpBar.style.transition = 'width 0.8s ease';
                hpBar.style.width = `${finalHpPercentage}%`;
            });
        });
    }
}