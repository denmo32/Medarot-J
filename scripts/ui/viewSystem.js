// scripts/systems/viewSystem.js:
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components.js';
import { TeamID, GamePhaseType, ModalType } from '../common/constants.js';
/**
 * ユーザーインタラクション（アクションパネル表示、ボタンイベントなど）とUIの状態管理に責務を特化させたシステム。
 * DOM要素の生成はDomFactorySystemに分離されました。
 */
export class ViewSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(Components.GameContext);
        this.confirmActionEntityId = null;
        this.currentModalType = null; // ★追加: 現在表示中のモーダルタイプを追跡
        
        // ★新規: モーダルシーケンス管理用
        this.modalSequence = [];
        this.isProcessingModalSequence = false;
        
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
            [ModalType.ATTACK_DECLARATION]: {
                title: '',
                actorName: (data) => data.message,
                confirmButton: { text: 'OK' }
            },
            [ModalType.EXECUTION_RESULT]: {
                title: '',
                actorName: (data) => data.message,
                // ★変更: confirmButtonを削除し、setupEventsで動的に制御
                contentHTML: '',
                setupEvents: (container, data) => this.setupExecutionResultEvents(container, data)
            },
            [ModalType.BATTLE_START_CONFIRM]: {
                title: '合意と見てよろしいですね！？',
                actorName: '', // ★修正: メッセージはタイトルに表示
                battleStartButton: true,
                contentHTML: '<div class="buttons-center"><button id="panelBtnBattleStart" class="action-panel-button">ロボトルファイト！</button></div>', // ★追加: 専用ボタン
                setupEvents: (container) => { // ★追加: イベント設定
                    const btn = container.querySelector('#panelBtnBattleStart');
                    if (btn) {
                        btn.onclick = () => {
                            this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
                            this.hideActionPanel();
                        };
                    }
                }
            },
            [ModalType.MESSAGE]: {
                title: '',
                actorName: (data) => data.message,
                confirmButton: { text: 'OK' }
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

            // ★変更: アクションタイプが「射撃」の場合のみ、インジケーター表示イベントを付与
            if (btn.action === '射撃' && targetDomRef && targetDomRef.targetIndicatorElement) {
                buttonEl.onmouseover = () => targetDomRef.targetIndicatorElement.classList.add('active');
                buttonEl.onmouseout = () => targetDomRef.targetIndicatorElement.classList.remove('active');
            }
        });
    }
    // Worldからのイベントを購読する
    bindWorldEvents() {
        this.world.on(GameEvents.SHOW_MODAL, (detail) => this.handleShowModal(detail.type, detail.data));
        this.world.on(GameEvents.HIDE_MODAL, () => this.hideActionPanel());
        this.world.on(GameEvents.GAME_START_REQUESTED, () => this.queueModal(ModalType.START_CONFIRM));
        this.world.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));
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
            // モーダルタイプに応じて処理を分岐
            switch (this.currentModalType) {
                case ModalType.GAME_OVER:
                    this.world.emit(GameEvents.RESET_BUTTON_CLICKED);
                    break;

                case ModalType.MESSAGE:
                    this.hideActionPanel();
                    break;

                case ModalType.ATTACK_DECLARATION:
                    if (this.confirmActionEntityId !== null) {
                        this.world.emit(GameEvents.ATTACK_DECLARATION_CONFIRMED, { entityId: this.confirmActionEntityId });
                    }
                    break;

                case ModalType.EXECUTION_RESULT:
                    if (this.confirmActionEntityId !== null) {
                        this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: this.confirmActionEntityId });
                        this.hideActionPanel();
                    }
                    break;
            }
        };
        this.dom.actionPanelConfirmButton.addEventListener('click', this.handlers.panelConfirm);
    }

    /**
     * ★新規: モーダル表示要求をシーケンスとして管理
     */
    handleShowModal(type, data) {
        // ★修正: 攻撃関連モーダルも即座に表示する（高優先度）
        if (type === ModalType.SELECTION || 
            type === ModalType.BATTLE_START_CONFIRM ||
            type === ModalType.ATTACK_DECLARATION ||
            type === ModalType.EXECUTION_RESULT) {
            this.showActionPanel(type, data);
            return;
        }
        this.queueModal(type, data);
    }
    
    /**
     * ★新規: モーダルをシーケンスに追加
     */
    queueModal(type, data) {
        this.modalSequence.push({ type, data });
        if (!this.isProcessingModalSequence) {
            this.processModalSequence();
        }
    }
    
    /**
     * ★新規: モーダルシーケンスを順番に処理
     */
    async processModalSequence() {
        this.isProcessingModalSequence = true;
        while (this.modalSequence.length > 0) {
            const { type, data } = this.modalSequence.shift();
            await this.showModalAndWait(type, data);
        }
        this.isProcessingModalSequence = false;
    }
    
    /**
     * ★新規: モーダルを表示して待機
     */
    showModalAndWait(type, data) {
        return new Promise(resolve => {
            // モーダル完了イベントを待機
            const completeHandler = (event) => {
                if (event.detail?.modalType === type) { // ★修正: entityIdのチェックを削除（汎用化）
                    this.world.off(GameEvents.MODAL_CLOSED, completeHandler);
                    resolve();
                }
            };
            this.world.on(GameEvents.MODAL_CLOSED, completeHandler);
            this.showActionPanel(type, data);
        });
    }

    /**
     * ★新規: 実行結果モーダルのイベントを設定します。
     * HPバーのアニメーション完了を待って確認ボタンを表示します。
     * @param {HTMLElement} container 
     * @param {object} data 
     */
    setupExecutionResultEvents(container, data) {
        const confirmButton = this.dom.actionPanelConfirmButton;
        confirmButton.textContent = 'OK';
        confirmButton.style.display = 'none'; // 最初は非表示

        const showButton = () => {
            confirmButton.style.display = 'inline-block';
            // アニメーション完了を通知
            this.world.emit(GameEvents.MODAL_CLOSED, { 
                entityId: data.entityId, 
                modalType: ModalType.EXECUTION_RESULT 
            });
        };

        // HP更新をトリガー
        this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: data.entityId });

        // ダメージがない、またはターゲット情報がない場合は即座にボタンを表示
        if (!data.damage || data.damage === 0 || !data.targetId || !data.targetPartKey) {
            showButton();
            return;
        }

        const targetDomRef = this.world.getComponent(data.targetId, Components.DOMReference);
        if (!targetDomRef || !targetDomRef.partDOMElements[data.targetPartKey]) {
            showButton();
            return;
        }

        const hpBarElement = targetDomRef.partDOMElements[data.targetPartKey].bar;

        const onTransitionEnd = (event) => {
            // widthプロパティのトランジションのみを対象とする
            if (event.propertyName === 'width') {
                showButton();
                clearTimeout(fallbackTimeout);
                hpBarElement.removeEventListener('transitionend', onTransitionEnd);
            }
        };

        hpBarElement.addEventListener('transitionend', onTransitionEnd);

        // フォールバックタイマー: CSSのtransition(0.8s)より少し長く設定
        const fallbackTimeout = setTimeout(() => {
            hpBarElement.removeEventListener('transitionend', onTransitionEnd);
            showButton();
        }, 1000);
    }

    /**
     * ★新規: HPバー要素を取得
     */
    getHPBarElement(targetId, targetPartKey) {
        const targetDomRef = this.world.getComponent(targetId, Components.DOMReference);
        if (!targetDomRef || !targetDomRef.partDOMElements[targetPartKey]) {
            return null;
        }
        return targetDomRef.partDOMElements[targetPartKey].bar;
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
        // ★修正: バトル開始確認モーダルの場合は特別な処理
        if (type === ModalType.BATTLE_START_CONFIRM) {
            this.world.emit(GameEvents.GAME_PAUSED);
            this.currentModalType = type;
            
            // タイトルとアクター名を設定
            this.dom.actionPanelTitle.textContent = config.title;
            this.dom.actionPanelActor.textContent = ''; // メッセージはタイトルに含まれる
            
            // コンテンツとイベントを設定
            this.dom.actionPanelButtons.innerHTML = config.contentHTML || '';
            if (config.setupEvents) {
                config.setupEvents(this.dom.actionPanelButtons, data);
            }
            
            // 他のボタンは非表示
            this.dom.actionPanelConfirmButton.style.display = 'none';
            this.dom.actionPanelBattleStartButton.style.display = 'none';
            return;
        }
        
        // ★修正: isPausedByModalフラグを直接操作せず、イベントを発行してGameFlowSystemに通知します。
        // これにより、UIの状態変化がゲームのコアロジックに直接影響を与えることを防ぎ、
        // 責務の分離をより明確にします。
        this.world.emit(GameEvents.GAME_PAUSED);
        // ★追加: 現在のモーダルタイプを保存
        this.currentModalType = type;

        if (type === ModalType.ATTACK_DECLARATION || type === ModalType.EXECUTION_RESULT) {
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
        // ★修正: モーダルクローズイベントを発行
        if (this.currentModalType) {
            this.world.emit(GameEvents.MODAL_CLOSED, { 
                modalType: this.currentModalType 
            });
        }
        
        // ★修正: isPausedByModalフラグを直接操作せず、イベントを発行してGameFlowSystemに通知します。
        // これにより、UIの状態変化がゲームのコアロジックに直接影響を与えることを防ぎ、
        // 責務の分離をより明確にします。
        this.world.emit(GameEvents.GAME_RESUMED);
        this.confirmActionEntityId = null;
        this.currentModalType = null; // ★追加: モーダルタイプをリセット
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
        // ★変更: 実際のアニメーション実行ロジックを RenderSystem に移譲します。
        // ViewSystem はアニメーションの「要求」を出すだけで、その「実行」は RenderSystem の責務です。
        // これにより、描画とアニメーションという密接な処理を一箇所で管理でき、コードの見通しが良くなります。
        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, { attackerId, targetId });
    }
}