// scripts/systems/viewSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import * as Components from '../components.js';
import { TeamID, GamePhaseType, ModalType } from '../constants.js';

/**
 * ユーザーインタラクション（アクションパネル表示、ボタンイベントなど）とUIの状態管理に責務を特化させたシステム。
 * DOM要素の生成はDomFactorySystemに分離されました。
 */
export class ViewSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(Components.GameContext);

        this.confirmActionEntityId = null;

        this.dom = {
            gameStartButton: document.getElementById('gameStartButton'),
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelConfirmButton: document.getElementById('action-panel-confirm-button'),
            actionPanelBattleStartButton: document.getElementById('action-panel-battle-start-button')
        };

        this.handlers = {
            gameStart: null,
            battleStart: null,
            panelConfirm: null
        };

        this.initializePanelConfigs();
        this.bindWorldEvents();
        this.bindDOMEvents();
        this.injectAnimationStyles();

        this.dom.actionPanel.classList.remove('hidden');
        this.hideActionPanel();
    }

    destroy() {
        // 登録したDOMイベントリスナーを削除
        if (this.handlers.gameStart) {
            this.dom.gameStartButton.removeEventListener('click', this.handlers.gameStart);
        }
        if (this.handlers.battleStart) {
            this.dom.actionPanelBattleStartButton.removeEventListener('click', this.handlers.battleStart);
        }
        if (this.handlers.panelConfirm) {
            this.dom.actionPanelConfirmButton.removeEventListener('click', this.handlers.panelConfirm);
        }
        // 動的に追加したスタイルシートを削除
        if (this.animationStyleElement) {
            document.head.removeChild(this.animationStyleElement);
            this.animationStyleElement = null;
        }
    }

    /**
     * ターゲット表示用アニメーションのCSSを動的に<head>へ注入します。
     * resetGame時に重複して注入されるのを防ぎます。
     */
    injectAnimationStyles() {
        const styleId = 'gemini-animation-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .target-indicator {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 70px; /* アイコンより広めのサイズに */
                height: 70px;
                transform: translate(-50%, -50%) scale(1); /* 初期スケールを追加 */
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease-in-out;
            }
            .target-indicator.active {
                opacity: 1;
                /* 回転をなくし、新しい縮小アニメーションを適用 */
                /* animation: radar-zoom-in 0.8s infinite ease-out; */
            }
            .corner {
                position: absolute;
                width: 15px; /* 矢印のサイズを少し大きく */
                height: 15px;
                border-color: cyan;
                border-style: solid;
            }

            /* ↖ */
            .corner-1 { top: 0; left: 0; border-width: 4px 0 0 4px; }
            /* ↗ */
            .corner-2 { top: 0; right: 0; border-width: 4px 4px 0 0; }
            /* ↙ */
            .corner-3 { bottom: 0; left: 0; border-width: 0 0 4px 4px; }
            /* ↘ */
            .corner-4 { bottom: 0; right: 0; border-width: 0 4px 4px 0; }

            /* 新しい縮小アニメーション */
            @keyframes radar-zoom-in {
                0% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
                80%, 100% {
                    transform: translate(-50%, -50%) scale(0.6);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        this.animationStyleElement = style; // クリーンアップ用に参照を保持
    }

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
            [ModalType.EXECUTION]: {
                title: '',
                actorName: (data) => data.message,
                confirmButton: { text: 'OK' }
            },
            [ModalType.BATTLE_START_CONFIRM]: {
                title: '合意と見てよろしいですね！？',
                actorName: '',
                battleStartButton: true
            },
            [ModalType.GAME_OVER]: {
                title: (data) => `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
                actorName: 'ロボトル終了！',
                confirmButton: { text: 'リセット' }
            }
        };
    }

    // ヘルパー: 三角レイアウトのHTMLを生成
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

    // ヘルパー: シンプルなイベントハンドラを作成
    createSimpleEventHandler(buttonConfigs) {
        return (container) => {
            buttonConfigs.forEach(({ id, action }) => {
                const btn = container.querySelector(`#${id}`);
                if (btn) btn.onclick = action;
            });
        };
    }

    // ヘルパー: 選択イベントの設定
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

            if (targetDomRef && targetDomRef.targetIndicatorElement) {
                buttonEl.onmouseover = () => targetDomRef.targetIndicatorElement.classList.add('active');
                buttonEl.onmouseout = () => targetDomRef.targetIndicatorElement.classList.remove('active');
            }
        });
    }

    // Worldからのイベントを購読する
    bindWorldEvents() {
        this.world.on(GameEvents.SHOW_MODAL, (detail) => this.showActionPanel(detail.type, detail.data));
        this.world.on(GameEvents.HIDE_MODAL, () => this.hideActionPanel());
        this.world.on(GameEvents.GAME_START_REQUESTED, () => this.showActionPanel(ModalType.START_CONFIRM));
        this.world.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, () => this.hideActionPanel());
        this.world.on(GameEvents.EXECUTION_ANIMATION_REQUESTED, this.onExecutionAnimationRequested.bind(this));
    }

    // DOM要素のイベントリスナーを登録する
    bindDOMEvents() {
        this.handlers.gameStart = () => {
            this.world.emit(GameEvents.GAME_START_REQUESTED);
        };
        this.dom.gameStartButton.addEventListener('click', this.handlers.gameStart);

        this.handlers.battleStart = () => {
            this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
        };
        this.dom.actionPanelBattleStartButton.addEventListener('click', this.handlers.battleStart);

        this.handlers.panelConfirm = () => {
            if (this.context.phase === GamePhaseType.GAME_OVER) {
                this.world.emit(GameEvents.RESET_BUTTON_CLICKED);
                return;
            }
            
            if (this.confirmActionEntityId !== null) {
                this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: this.confirmActionEntityId });
            }
        };
        this.dom.actionPanelConfirmButton.addEventListener('click', this.handlers.panelConfirm);
    }

    /**
     * UIの状態をリセットします。
     * DOM要素のクリアはDomFactorySystemが担当します。
     */
    resetView() {
        this.dom.gameStartButton.style.display = "flex";
        this.hideActionPanel();
    }

    update(deltaTime) {
        // ゲーム開始ボタンの表示/非表示を管理
        this.dom.gameStartButton.style.display = this.context.phase === GamePhaseType.IDLE ? "flex" : "none";
    }

    // --- アクションパネル表示/非表示 ---

    showActionPanel(type, data) {
        const config = this.panelConfigs[type];
        if (!config) {
            this.hideActionPanel();
            return;
        }

        // ★変更: isPausedByModalフラグを直接操作せず、イベントを発行してGameFlowSystemに通知します。
        // this.context.isPausedByModal = true;
        this.world.emit(GameEvents.GAME_PAUSED);
        
        if (type === ModalType.EXECUTION) {
            this.confirmActionEntityId = data.entityId;
        }

        if (type === ModalType.SELECTION) {
            this.dom.actionPanelOwner.textContent = data.ownerName || '';
        }

        const { actionPanelTitle, actionPanelActor, actionPanelButtons, actionPanelConfirmButton, actionPanelBattleStartButton } = this.dom;

        const getValue = (value) => typeof value === 'function' ? value(data) : value;

        actionPanelTitle.textContent = getValue(config.title) || '';
        actionPanelActor.textContent = getValue(config.actorName) || '';
        actionPanelButtons.innerHTML = getValue(config.contentHTML) || '';
        
        actionPanelConfirmButton.style.display = 'none';
        actionPanelBattleStartButton.style.display = 'none';

        if (config.setupEvents) {
            config.setupEvents(actionPanelButtons, data);
        }

        if (config.confirmButton) {
            actionPanelConfirmButton.textContent = getValue(config.confirmButton.text);
            actionPanelConfirmButton.style.display = 'inline-block';
        }
        if (config.battleStartButton) {
            actionPanelBattleStartButton.style.display = 'inline-block';
        }
    }

    hideActionPanel() {
        // ★変更: isPausedByModalフラグを直接操作せず、イベントを発行してGameFlowSystemに通知します。
        // this.context.isPausedByModal = false;
        this.world.emit(GameEvents.GAME_RESUMED);

        this.confirmActionEntityId = null;

        // 表示されている可能性のあるインジケーターを非表示にする
        const activeIndicator = document.querySelector('.target-indicator.active');
        if (activeIndicator) {
            activeIndicator.classList.remove('active');
        }

        // actionPanelの内容をクリアする
        this.dom.actionPanelOwner.textContent = '';
        this.dom.actionPanelTitle.textContent = '';
        this.dom.actionPanelActor.textContent = '待機中...'; // デフォルトメッセージ
        this.dom.actionPanelButtons.innerHTML = '';
        this.dom.actionPanelConfirmButton.style.display = 'none';
        this.dom.actionPanelBattleStartButton.style.display = 'none';
    }

    /**
     * ActionSystemからの要求を受け、実行アニメーションを再生します。
     * @param {object} detail - { attackerId, targetId }
     */
    onExecutionAnimationRequested(detail) {
        const { attackerId, targetId } = detail;

        const attackerDomRef = this.world.getComponent(attackerId, Components.DOMReference);
        const targetDomRef = this.world.getComponent(targetId, Components.DOMReference);

        if (!attackerDomRef || !targetDomRef || !attackerDomRef.iconElement || !targetDomRef.iconElement || !attackerDomRef.targetIndicatorElement) {
            console.warn('ViewSystem: Missing DOM elements for animation. Skipping.', detail);
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        // ゲージ進行などを停止
        this.world.emit(GameEvents.GAME_PAUSED);

        const indicator = attackerDomRef.targetIndicatorElement;
        const attackerIcon = attackerDomRef.iconElement;
        const targetIcon = targetDomRef.iconElement;

        // ★根本原因の修正: 親要素のtransformから逃れるため、アニメーション中だけインジケーターをbody直下に移動
        const originalParent = indicator.parentNode;
        document.body.appendChild(indicator);

        // ★タイミング問題の修正: ターゲットアイコンのCSS transition完了を待つため、少し遅延させる
        setTimeout(() => {
            // 座標計算
            const attackerRect = attackerIcon.getBoundingClientRect();
            const targetRect = targetIcon.getBoundingClientRect();
            
            // インジケーターを一時的に fixed ポジションにして、ページ全体でアニメーションさせる
            const originalStyle = {
                position: indicator.style.position,
                top: indicator.style.top,
                left: indicator.style.left,
                transform: indicator.style.transform,
                transition: indicator.style.transition,
                zIndex: indicator.style.zIndex
            };

            indicator.style.transition = 'none'; // JSアニメーション中はCSSのtransitionを無効化
            indicator.style.position = 'fixed';
            indicator.style.zIndex = '100';
            
            // アニメーション開始時にactiveクラスを追加して表示状態にする
            indicator.classList.add('active');

            // 攻撃者アイコンの中心座標を初期位置とする
            const startX = attackerRect.left + attackerRect.width / 2;
            const startY = attackerRect.top + attackerRect.height / 2;

            // ターゲットアイコンの中心座標を最終位置とする
            const endX = targetRect.left + targetRect.width / 2;
            const endY = targetRect.top + targetRect.height / 2;

            // インジケーターの初期位置を設定 (fixedなのでビューポート基準)
            indicator.style.left = `${startX}px`;
            indicator.style.top = `${startY}px`;
            
            const animation = indicator.animate([
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1, offset: 0 }, // 初期スケールと不透明度
                { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 1, offset: 0.2 }, // 拡大
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(1.5)`, opacity: 1, offset: 0.8 }, // 移動と維持
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(0.5)`, opacity: 0, offset: 1 } // 縮小とフェードアウト
            ], {
                duration: 800, // 0.8秒
                easing: 'ease-in-out'
            });

            animation.finished.then(() => {
                // ★修正: インジケーターを元の親要素に戻す
                if(originalParent) originalParent.appendChild(indicator);

                // アニメーション後にインジケーターのスタイルを元に戻す
                indicator.style.position = originalStyle.position;
                indicator.style.top = originalStyle.top;
                indicator.style.left = originalStyle.left;
                indicator.style.transform = originalStyle.transform;
                indicator.style.transition = originalStyle.transition;
                indicator.style.zIndex = originalStyle.zIndex;
                indicator.classList.remove('active');

                // ActionSystemにアニメーション完了を通知
                this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            });
        }, 150); // 150msの遅延 (CSS transitionが0.1sのため)
    }
}
