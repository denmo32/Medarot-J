import { BaseSystem } from '../../core/baseSystem.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components.js';
// ★変更: EffectType をインポート
import { ModalType, PartInfo, PartKeyToInfoMap, EffectType } from '../common/constants.js';
import { InputManager } from '../../core/InputManager.js';
import { UIManager } from './UIManager.js';

export class ActionPanelSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.inputManager = new InputManager(); // ★新規: InputManagerのインスタンスを取得
        this.confirmActionEntityId = null;
        this.currentModalType = null;
        this.currentModalData = null;

        this.dom = {
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelConfirmButton: document.getElementById('action-panel-confirm-button'),
            actionPanelBattleStartButton: document.getElementById('action-panel-battle-start-button'),
            actionPanelIndicator: document.getElementById('action-panel-indicator')
        };

        this.focusedButtonKey = null;
        this.handlers = {
            panelConfirm: null,
            battleStart: null,
            panelClick: null,
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
                clickable: true, // ★変更
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
        // ACTION_EXECUTEDイベントを購読し、結果表示モーダルを出す
        this.world.on(GameEvents.ACTION_EXECUTED, (detail) => this.onActionExecuted(detail));
    }

    /**
     * このシステムが管理するDOM要素のイベントリスナーを登録します。
     */
    bindDOMEvents() {
        // ★変更: confirmButtonのクリックもhandlePanelClickに集約
        this.handlers.panelConfirm = () => {
            this.handlePanelClick();
        };
        this.dom.actionPanelConfirmButton.addEventListener('click', this.handlers.panelConfirm);
    }

    update(deltaTime) {
        // アクションパネルが表示されていない場合は何もしない
        if (!this.currentModalType) return;

        // 選択モーダルでのキー操作
        if (this.currentModalType === ModalType.SELECTION) {
            if (this.inputManager.wasKeyJustPressed('ArrowUp')) {
                this.handleArrowKeyNavigation('arrowup');
            }
            if (this.inputManager.wasKeyJustPressed('ArrowDown')) {
                this.handleArrowKeyNavigation('arrowdown');
            }
            if (this.inputManager.wasKeyJustPressed('ArrowLeft')) {
                this.handleArrowKeyNavigation('arrowleft');
            }
            if (this.inputManager.wasKeyJustPressed('ArrowRight')) {
                this.handleArrowKeyNavigation('arrowright');
            }
            if (this.inputManager.wasKeyJustPressed('z')) {
                this.confirmSelection();
            }
        } 
        // バトル開始確認モーダルでのキー操作
        else if (this.currentModalType === ModalType.BATTLE_START_CONFIRM) {
            if (this.inputManager.wasKeyJustPressed('z')) {
                this.handlePanelClick();
            } else if (this.inputManager.wasKeyJustPressed('x')) {
                this.world.emit(GameEvents.BATTLE_START_CANCELLED);
                this.hideActionPanel();
            }
        }
        // それ以外のクリック進行モーダルでのキー操作
        else if (this.inputManager.wasKeyJustPressed('z') && this.dom.actionPanel.classList.contains('clickable')) {
            this.handlePanelClick();
        }
    }

    /**
     * ★新規: パネル全体がクリックされた際の統一処理
     */
    handlePanelClick() {
        switch (this.currentModalType) {
            case ModalType.BATTLE_START_CONFIRM: // ★新規
                this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
                this.hideActionPanel();
                break;
            case ModalType.GAME_OVER:
                this.world.emit(GameEvents.RESET_BUTTON_CLICKED);
                this.hideActionPanel();
                break;
            case ModalType.MESSAGE:
                this.hideActionPanel();
                break;
            case ModalType.ATTACK_DECLARATION:
                if (this.confirmActionEntityId !== null) {
                    // ATTACK_DECLARATION_CONFIRMEDに必要なデータを再構築
                    const { entityId, resolvedEffects, isEvaded, isSupport } = this.currentModalData;
                    this.world.emit(GameEvents.ATTACK_DECLARATION_CONFIRMED, {
                        entityId,
                        resolvedEffects,
                        isEvaded,
                        isSupport,
                    });
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
     * ★新規: 行動実行結果を受け取り、結果表示モーダルを表示するハンドラ
     * @param {object} detail - ACTION_EXECUTEDイベントのペイロード
     */
    onActionExecuted(detail) {
        const resultMessage = this._generateResultMessage(detail);
        
        // ACTION_EXECUTED イベントを受け、UIに結果を表示するためのモーダル表示を要求する
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION_RESULT,
            data: {
                message: resultMessage,
                // ★変更: HPバーアニメーションに必要な情報をペイロードから取得
                entityId: detail.attackerId,
                damageEffect: detail.resolvedEffects.find(e => e.type === EffectType.DAMAGE)
            },
            immediate: true
        });
    }
    
    /**
     * @private
     * 攻撃結果に基づいてUIに表示するメッセージを生成します。
     * @param {object} detail - ACTION_EXECUTEDイベントのペイロード
     * @returns {string} 生成された結果メッセージ
     */
    _generateResultMessage(detail) {
        const { resolvedEffects, isEvaded, isSupport } = detail;
        
        // 支援行動の場合
        if (isSupport) {
            const scanEffect = resolvedEffects.find(e => e.type === EffectType.APPLY_SCAN);
            return scanEffect?.message || '支援行動成功！';
        }

        // 回避された場合
        if (isEvaded) {
            const damageEffect = resolvedEffects.find(e => e.type === EffectType.DAMAGE);
            const targetId = damageEffect ? damageEffect.targetId : null;
            const targetInfo = targetId ? this.world.getComponent(targetId, Components.PlayerInfo) : null;
            return targetInfo ? `${targetInfo.name}は攻撃を回避！` : '攻撃は回避された！';
        }

        // ダメージ効果がある場合
        const damageEffect = resolvedEffects.find(e => e.type === EffectType.DAMAGE);
        if (damageEffect) {
            const { targetId, partKey, value: damage, isCritical, isDefended } = damageEffect;
            const targetInfo = this.world.getComponent(targetId, Components.PlayerInfo);
            
            if (!targetInfo) return '不明なターゲットへの攻撃';

            const finalTargetPartName = PartKeyToInfoMap[partKey]?.name || '不明な部位';
            let message = '';

            if (isCritical) message = 'クリティカル！ ';
            
            if (isDefended) {
                message += `${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${damage}ダメージ！`;
            } else {
                message += `${targetInfo.name}の${finalTargetPartName}に${damage}ダメージ！`;
            }
            return message;
        }

        // 上記のいずれでもない場合（空振りなど）
        return '攻撃は空を切った！';
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

        // ★新規: 選択モーダルの場合、キーボード操作のための初期フォーカスを設定
        if (type === ModalType.SELECTION) {
            const availableButtons = data.buttons.filter(b => !b.isBroken);
            // 優先順位: 頭 -> 右腕 -> 左腕
            const initialFocusKey = 
                availableButtons.find(b => b.partKey === PartInfo.HEAD.key)?.partKey ||
                availableButtons.find(b => b.partKey === PartInfo.RIGHT_ARM.key)?.partKey ||
                availableButtons.find(b => b.partKey === PartInfo.LEFT_ARM.key)?.partKey;

            if (initialFocusKey) {
                // DOMの描画を待ってからフォーカスを設定
                setTimeout(() => this.updateFocus(initialFocusKey), 0);
            }
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

        // ★新規: フォーカスをクリア
        if (this.focusedButtonKey) {
            const oldButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
            if (oldButton) oldButton.classList.remove('focused');
        }
        this.focusedButtonKey = null;

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
        const targetDomElements = data.targetId !== null ? this.uiManager.getDOMElements(data.targetId) : null;
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

            if (btn.action === '射撃' && targetDomElements && targetDomElements.targetIndicatorElement) {
                buttonEl.onmouseover = () => targetDomElements.targetIndicatorElement.classList.add('active');
                buttonEl.onmouseout = () => targetDomElements.targetIndicatorElement.classList.remove('active');
            }
        });
    }

    setupExecutionResultEvents(container, data) {
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
        
        // ★変更: damageEffect を参照してHPバーアニメーションを制御
        const { damageEffect } = data;
        if (!damageEffect || damageEffect.value === 0) {
            showClickable();
            return;
        }

        const { targetId, partKey } = damageEffect;
        const targetDomElements = this.uiManager.getDOMElements(targetId);
        if (!targetDomElements || !targetDomElements.partDOMElements[partKey]) {
            showClickable();
            return;
        }

        const hpBarElement = targetDomElements.partDOMElements[partKey].bar;

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

    // --- ★新規: Keyboard Navigation Helpers ---

    /**
     * 矢印キーによるボタンのフォーカス移動を処理します。
     * @param {string} key - 押された矢印キー ('arrowup', 'arrowdown', 'arrowleft', 'arrowright')
     */
    handleArrowKeyNavigation(key) {
        if (!this.currentModalData?.buttons) return;

        const availableButtons = this.currentModalData.buttons.filter(b => !b.isBroken);
        if (availableButtons.length === 0) return;

        let nextFocusKey = this.focusedButtonKey;
        const has = (partKey) => availableButtons.some(b => b.partKey === partKey);

        switch (this.focusedButtonKey) {
            case PartInfo.HEAD.key:
                if (key === 'arrowdown' || key === 'arrowleft') {
                    if (has(PartInfo.RIGHT_ARM.key)) nextFocusKey = PartInfo.RIGHT_ARM.key;
                    else if (has(PartInfo.LEFT_ARM.key)) nextFocusKey = PartInfo.LEFT_ARM.key;
                } else if (key === 'arrowright') {
                    if (has(PartInfo.LEFT_ARM.key)) nextFocusKey = PartInfo.LEFT_ARM.key;
                    else if (has(PartInfo.RIGHT_ARM.key)) nextFocusKey = PartInfo.RIGHT_ARM.key;
                }
                break;
            case PartInfo.RIGHT_ARM.key:
                if (key === 'arrowup') {
                    if (has(PartInfo.HEAD.key)) nextFocusKey = PartInfo.HEAD.key;
                } else if (key === 'arrowright') {
                    if (has(PartInfo.LEFT_ARM.key)) nextFocusKey = PartInfo.LEFT_ARM.key;
                }
                break;
            case PartInfo.LEFT_ARM.key:
                if (key === 'arrowup') {
                    if (has(PartInfo.HEAD.key)) nextFocusKey = PartInfo.HEAD.key;
                } else if (key === 'arrowleft') {
                    if (has(PartInfo.RIGHT_ARM.key)) nextFocusKey = PartInfo.RIGHT_ARM.key;
                }
                break;
            default: // no focus
                if (has(PartInfo.HEAD.key)) nextFocusKey = PartInfo.HEAD.key;
                else if (has(PartInfo.RIGHT_ARM.key)) nextFocusKey = PartInfo.RIGHT_ARM.key;
                else if (has(PartInfo.LEFT_ARM.key)) nextFocusKey = PartInfo.LEFT_ARM.key;
                break;
        }

        this.updateFocus(nextFocusKey);
    }

    /**
     * 指定されたキーのボタンにフォーカスを移動します。
     * @param {string} newKey - 新しくフォーカスするボタンのパーツキー
     */
    updateFocus(newKey) {
        if (this.focusedButtonKey === newKey) return;

        const targetDomElements = this.currentModalData?.targetId !== null 
            ? this.uiManager.getDOMElements(this.currentModalData.targetId) 
            : null;

        // 古いフォーカスを解除
        if (this.focusedButtonKey) {
            const oldButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
            if (oldButton) oldButton.classList.remove('focused');
        }

        // 新しいフォーカスを設定
        const newButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${newKey}`);
        if (newButton) {
            newButton.classList.add('focused');
            this.focusedButtonKey = newKey;

            // インジケーターの更新
            const newButtonData = this.currentModalData?.buttons.find(b => b.partKey === newKey);
            if (newButtonData?.action === '射撃' && targetDomElements?.targetIndicatorElement) {
                targetDomElements.targetIndicatorElement.classList.add('active');
            } else if (targetDomElements?.targetIndicatorElement) {
                // 新しいフォーカスが射撃でない場合、インジケーターを消す
                targetDomElements.targetIndicatorElement.classList.remove('active');
            }
        } else {
            // フォーカスが外れた場合
            this.focusedButtonKey = null;
            if (targetDomElements?.targetIndicatorElement) {
                targetDomElements.targetIndicatorElement.classList.remove('active');
            }
        }
    }

    /**
     * 現在フォーカスされているボタンの選択を決定します。
     */
    confirmSelection() {
        if (!this.focusedButtonKey) return;

        const focusedButton = this.dom.actionPanelButtons.querySelector(`#panelBtn-${this.focusedButtonKey}`);
        if (focusedButton && !focusedButton.disabled) {
            focusedButton.click(); // clickイベントを発火させるのが最もシンプルで確実
        }
    }
}