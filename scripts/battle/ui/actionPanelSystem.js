import { BaseSystem } from '../../core/baseSystem.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components.js';
import { ModalType } from '../common/constants.js';

export class ActionPanelSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.confirmActionEntityId = null;
        this.currentModalType = null;
        this.currentModalData = null; // ★新規: 表示中モーダルのデータを保持

        this.dom = {
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelConfirmButton: document.getElementById('action-panel-confirm-button'),
            actionPanelBattleStartButton: document.getElementById('action-panel-battle-start-button'),
            actionPanelIndicator: document.getElementById('action-panel-indicator') // ★追加
        };

        this.handlers = {
            panelConfirm: null,
            battleStart: null,
            panelClick: null // ★追加
        };

        this.initializePanelConfigs();
        this.bindWorldEvents();
        this.bindDOMEvents();

        // 初期状態ではパネルを非表示にする
        this.dom.actionPanel.classList.remove('hidden');
        this.hideActionPanel();
    }

    /**
     * このシステムが管理するDOMイベントリスナーを全て破棄します。
     */
    destroy() {
        if (this.handlers.battleStart) {
            this.dom.actionPanelBattleStartButton.removeEventListener('click', this.handlers.battleStart);
        }
        if (this.handlers.panelConfirm) {
            this.dom.actionPanelConfirmButton.removeEventListener('click', this.handlers.panelConfirm);
        }
        // ★追加
        if (this.handlers.panelClick) {
            this.dom.actionPanel.removeEventListener('click', this.handlers.panelClick);
        }
    }

    /**
     * 各モーダルタイプに対応する設定を初期化します。
     */
    initializePanelConfigs() {
        this.panelConfigs = {
            [ModalType.START_CONFIRM]: {
                title: '',
                actorName: 'ロボトルを開始しますか？',
                contentHTML: `
                    <div class="buttons-center">
                        <button id="panelBtnYes" class="action-panel-button">OK</button>
                        <button id="panelBtnNo" class="action-panel-button bg-red-500 hover:bg-red-600">キャンセル</button>
                    </div>`,
                setupEvents: this.createSimpleEventHandler([
                    { id: 'panelBtnYes', action: () => { this.world.emit(GameEvents.GAME_START_CONFIRMED); this.hideActionPanel(); } },
                    { id: 'panelBtnNo', action: () => this.hideActionPanel() }
                ])
            },
            [ModalType.SELECTION]: {
                title: (data) => data.title,
                actorName: '',
                contentHTML: (data) => this.generateTriangleLayoutHTML(data.buttons),
                setupEvents: (container, data) => this.setupSelectionEvents(container, data)
            },
            [ModalType.ATTACK_DECLARATION]: {
                title: '',
                actorName: (data) => data.message,
                clickable: true // ★変更
            },
            [ModalType.EXECUTION_RESULT]: {
                title: '',
                actorName: (data) => data.message,
                contentHTML: '',
                setupEvents: (container, data) => this.setupExecutionResultEvents(container, data)
                // ★変更: clickableはsetupEvents内で制御
            },
            [ModalType.BATTLE_START_CONFIRM]: {
                title: '',
                actorName: '合意と見てよろしいですね！？',
                battleStartButton: true,
                contentHTML: '',
                setupEvents: null
            },
            [ModalType.MESSAGE]: {
                title: '',
                actorName: (data) => data.message,
                clickable: true // ★変更
            },
            [ModalType.GAME_OVER]: {
                title: (data) => `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
                actorName: 'ロボトル終了！',
                clickable: true // ★変更
            }
        };
    }

    /**
     * Worldから発行されるイベントを購読します。
     */
    bindWorldEvents() {
        this.world.on(GameEvents.SHOW_MODAL, (detail) => this.showActionPanel(detail.type, detail.data));
        this.world.on(GameEvents.HIDE_MODAL, () => this.hideActionPanel());
    }

    /**
     * このシステムが管理するDOM要素のイベントリスナーを登録します。
     */
    bindDOMEvents() {
        this.handlers.battleStart = () => {
            this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
        };
        this.dom.actionPanelBattleStartButton.addEventListener('click', this.handlers.battleStart);

        // ★変更: confirmButtonのクリックもhandlePanelClickに集約
        this.handlers.panelConfirm = () => {
            this.handlePanelClick();
        };
        this.dom.actionPanelConfirmButton.addEventListener('click', this.handlers.panelConfirm);
    }

    /**
     * ★新規: パネル全体がクリックされた際の統一処理
     */
    handlePanelClick() {
        switch (this.currentModalType) {
            case ModalType.GAME_OVER:
                this.world.emit(GameEvents.RESET_BUTTON_CLICKED);
                this.hideActionPanel();
                break;
            case ModalType.MESSAGE:
                this.hideActionPanel();
                break;
            case ModalType.ATTACK_DECLARATION:
                if (this.confirmActionEntityId !== null) {
                    // ★修正: 保持しておいたモーダルの全データをペイロードとして渡す
                    this.world.emit(GameEvents.ATTACK_DECLARATION_CONFIRMED, this.currentModalData);
                }
                break;
            case ModalType.EXECUTION_RESULT:
                if (this.confirmActionEntityId !== null) {
                    this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: this.confirmActionEntityId });
                    this.hideActionPanel();
                }
                break;
        }
    }

    /**
     * アクションパネルを表示し、指定されたタイプのモーダルを構成します。
     * @param {string} type - 表示するモーダルのタイプ (ModalType)
     * @param {object} data - モーダルのコンテンツを生成するためのデータ
     */
    showActionPanel(type, data) {
        const config = this.panelConfigs[type];
        if (!config) {
            this.hideActionPanel();
            return;
        }

        this.world.emit(GameEvents.GAME_PAUSED);
        this.currentModalType = type;
        this.currentModalData = data; // ★新規: データを保持

        if (type === ModalType.ATTACK_DECLARATION || type === ModalType.EXECUTION_RESULT) {
            this.confirmActionEntityId = data.entityId;
        }

        const { actionPanel, actionPanelOwner, actionPanelTitle, actionPanelActor, actionPanelButtons, actionPanelConfirmButton, actionPanelBattleStartButton, actionPanelIndicator } = this.dom;
        const getValue = (value) => typeof value === 'function' ? value(data) : value;

        // --- Reset panel state ---
        actionPanelOwner.textContent = data.ownerName || '';
        actionPanelTitle.textContent = getValue(config.title) || '';
        actionPanelActor.textContent = getValue(config.actorName) || '';
        actionPanelButtons.innerHTML = getValue(config.contentHTML) || '';
        actionPanelConfirmButton.style.display = 'none';
        actionPanelBattleStartButton.style.display = 'none';
        actionPanelIndicator.classList.add('hidden');
        actionPanel.classList.remove('clickable');
        if (this.handlers.panelClick) {
            actionPanel.removeEventListener('click', this.handlers.panelClick);
            this.handlers.panelClick = null;
        }

        // --- Configure based on modal type ---
        if (config.setupEvents) {
            config.setupEvents(actionPanelButtons, data);
        }

        if (config.clickable) {
            actionPanelIndicator.classList.remove('hidden');
            actionPanel.classList.add('clickable');
            this.handlers.panelClick = () => this.handlePanelClick();
            actionPanel.addEventListener('click', this.handlers.panelClick);
        } else if (config.confirmButton) {
            actionPanelConfirmButton.textContent = getValue(config.confirmButton.text);
            actionPanelConfirmButton.style.display = 'inline-block';
        }

        if (config.battleStartButton) {
            actionPanelBattleStartButton.style.display = 'inline-block';
        }
    }

    /**
     * アクションパネルを非表示にし、関連する状態をリセットします。
     */
    hideActionPanel() {
        if (this.currentModalType) {
            this.world.emit(GameEvents.MODAL_CLOSED, { modalType: this.currentModalType });
        }

        this.world.emit(GameEvents.GAME_RESUMED);
        this.confirmActionEntityId = null;
        this.currentModalType = null;
        this.currentModalData = null; // ★新規: データをクリア

        const { actionPanel, actionPanelOwner, actionPanelTitle, actionPanelActor, actionPanelButtons, actionPanelConfirmButton, actionPanelBattleStartButton, actionPanelIndicator } = this.dom;

        // ★追加: クリックリスナーと関連クラスのクリーンアップ
        actionPanel.classList.remove('clickable');
        if (this.handlers.panelClick) {
            actionPanel.removeEventListener('click', this.handlers.panelClick);
            this.handlers.panelClick = null;
        }
        actionPanelIndicator.classList.add('hidden');

        const activeIndicator = document.querySelector('.target-indicator.active');
        if (activeIndicator) {
            activeIndicator.classList.remove('active');
        }

        actionPanelOwner.textContent = '';
        actionPanelTitle.textContent = '';
        actionPanelActor.textContent = '待機中...';
        actionPanelButtons.innerHTML = '';
        actionPanelConfirmButton.style.display = 'none';
        actionPanelBattleStartButton.style.display = 'none';
    }

    // --- Event Setup Helpers ---

    setupSelectionEvents(container, data) {
        const targetDomRef = data.targetId !== null ? this.world.getComponent(data.targetId, Components.DOMReference) : null;
        data.buttons.forEach(btn => {
            if (btn.isBroken) return;
            const buttonEl = container.querySelector(`#panelBtn-${btn.partKey}`);
            if (!buttonEl) return;

            buttonEl.onclick = () => {
                this.world.emit(GameEvents.PART_SELECTED, {
                    entityId: data.entityId,
                    partKey: btn.partKey,
                    targetId: data.targetId,
                    targetPartKey: data.targetPartKey
                });
                this.hideActionPanel();
            };

            if (btn.action === '射撃' && targetDomRef && targetDomRef.targetIndicatorElement) {
                buttonEl.onmouseover = () => targetDomRef.targetIndicatorElement.classList.add('active');
                buttonEl.onmouseout = () => targetDomRef.targetIndicatorElement.classList.remove('active');
            }
        });
    }

    setupExecutionResultEvents(container, data) {
        // ★変更: HPバーアニメーション後にパネルをクリック可能にする
        const showClickable = () => {
            this.dom.actionPanel.classList.add('clickable');
            this.dom.actionPanelIndicator.classList.remove('hidden');
            if (!this.handlers.panelClick) {
                this.handlers.panelClick = () => this.handlePanelClick();
                this.dom.actionPanel.addEventListener('click', this.handlers.panelClick);
            }
            this.world.emit(GameEvents.MODAL_CLOSED, {
                entityId: data.entityId,
                modalType: ModalType.EXECUTION_RESULT
            });
        };

        if (!data.damage || data.damage === 0 || !data.targetId || !data.targetPartKey) {
            showClickable();
            return;
        }

        const targetDomRef = this.world.getComponent(data.targetId, Components.DOMReference);
        if (!targetDomRef || !targetDomRef.partDOMElements[data.targetPartKey]) {
            showClickable();
            return;
        }

        const hpBarElement = targetDomRef.partDOMElements[data.targetPartKey].bar;

        requestAnimationFrame(() => {
            const onTransitionEnd = (event) => {
                if (event.propertyName === 'width') {
                    showClickable();
                    clearTimeout(fallbackTimeout);
                    hpBarElement.removeEventListener('transitionend', onTransitionEnd);
                }
            };
            hpBarElement.addEventListener('transitionend', onTransitionEnd);
            const fallbackTimeout = setTimeout(() => {
                hpBarElement.removeEventListener('transitionend', onTransitionEnd);
                showClickable();
            }, 1000);
        });
    }

    createSimpleEventHandler(buttonConfigs) {
        return (container) => {
            buttonConfigs.forEach(({ id, action }) => {
                const btn = container.querySelector(`#${id}`);
                if (btn) btn.onclick = action;
            });
        };
    }

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
            </div>
        `;
    }
}