// scripts/systems/viewSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import * as Components from '../components.js';
import { TeamID, GamePhaseType, ModalType } from '../constants.js';

/**
 * ★クラス名変更: UiSystem -> ViewSystem
 * ユーザーインタラクション（アクションパネル表示、ボタンイベントなど）とUIの状態管理に責務を特化させたシステム。
 * DOM要素の生成はDomFactorySystemに分離されました。
 */
export class ViewSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(Components.GameContext);

        this.confirmActionEntityId = null;

        // ★変更: DOM参照を新しいアクションパネルの要素に更新
        this.dom = {
            gameStartButton: document.getElementById('gameStartButton'),
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'), // ★新規: owner要素への参照を追加
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelConfirmButton: document.getElementById('action-panel-confirm-button'),
            actionPanelBattleStartButton: document.getElementById('action-panel-battle-start-button')
        };

        // --- ★変更: イベントハンドラを保持するプロパティ (モーダルからパネル用に変更) ---
        this.handlers = {
            gameStart: null,
            battleStart: null,
            panelConfirm: null // modalConfirm -> panelConfirm
        };

        // ★変更: 設定初期化メソッド名を変更
        this.initializePanelConfigs();
        this.bindWorldEvents();
        this.bindDOMEvents();
        this.injectAnimationStyles();

        // ★新規: 初期化時にアクションパネルを常に表示状態にする
        this.dom.actionPanel.classList.remove('hidden');
        // ★新規: 初期状態ではパネルの内容をクリアしておく
        this.hideActionPanel();
    }

    // ★変更: クリーンアップメソッドを新しいDOM構造とハンドラに適応
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
                width: 40px;
                height: 40px;
                border: 3px solid cyan;
                border-radius: 50%;
                transform: translate(-50%, -50%) scale(1);
                opacity: 0;
                pointer-events: none; /* クリックイベントを透過させる */
                transition: opacity 0.2s ease-in-out;
            }
            .target-indicator.active {
                opacity: 1;
                animation: pulse 1.5s infinite ease-in-out;
            }
            @keyframes pulse {
                0% {
                    transform: translate(-50%, -50%) scale(0.9);
                    opacity: 0.7;
                }
                70% {
                    transform: translate(-50%, -50%) scale(1.5);
                    opacity: 0;
                }
                100% {
                    transform: translate(-50%, -50%) scale(0.9);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        this.animationStyleElement = style; // クリーンアップ用に参照を保持
    }

    // ★変更: アクションパネルの設定を初期化する (旧initializeModalConfigs)
    initializePanelConfigs() {
        // ★変更: プロパティ名を modalConfigs から panelConfigs に変更
        this.panelConfigs = {
            [ModalType.START_CONFIRM]: {
                title: '', // ★変更: ユーザーの指示によりタイトルを削除
                actorName: 'ロボトルを開始しますか？', // ★変更: メッセージを修正
                contentHTML: `
                    <div class="buttons-center">
                        <button id="panelBtnYes" class="action-panel-button">OK</button>
                        <button id="panelBtnNo" class="action-panel-button bg-red-500 hover:bg-red-600">キャンセル</button>
                    </div>`, // ★変更: ボタンのテキストを修正
                setupEvents: (container) => {
                    container.querySelector('#panelBtnYes').onclick = () => {
                        this.world.emit(GameEvents.GAME_START_CONFIRMED);
                        this.hideActionPanel();
                    };
                    container.querySelector('#panelBtnNo').onclick = () => this.hideActionPanel();
                }
            },
            [ModalType.SELECTION]: {
                title: (data) => data.title,
                // ★変更: actorNameは左上のownerNameに置き換わるため、ここでは空にする
                actorName: '', 
                // ★変更: isBrokenフラグを見て、ボタンにdisabled属性を追加する
                contentHTML: (data) => data.buttons.map((btn, index) => 
                    `<button id="panelBtnPart${index}" class="part-action-button" ${btn.isBroken ? 'disabled' : ''}>${btn.text}</button>`
                ).join(''),
                setupEvents: (container, data) => {
                    // 事前計算されたターゲットのDOM参照を取得
                    const targetDomRef = data.targetId !== null ? this.world.getComponent(data.targetId, Components.DOMReference) : null;

                    data.buttons.forEach((btn, index) => {
                        const buttonEl = container.querySelector(`#panelBtnPart${index}`);
                        if (!buttonEl) return;

                        // ★変更: 破壊されたパーツのボタンにはイベントリスナーを登録しない
                        if (btn.isBroken) return;

                        // クリック時に、事前に計算したターゲット情報も一緒にイベント発行する
                        buttonEl.onclick = () => {
                            this.world.emit(GameEvents.PART_SELECTED, { 
                                entityId: data.entityId, 
                                partKey: btn.partKey,
                                targetId: data.targetId,
                                targetPartKey: data.targetPartKey
                            });
                            this.hideActionPanel();
                        };

                        // ホバー時にターゲットのインジケーターをアニメーションさせる
                        if (targetDomRef && targetDomRef.targetIndicatorElement) {
                            buttonEl.onmouseover = () => {
                                targetDomRef.targetIndicatorElement.classList.add('active');
                            };
                            buttonEl.onmouseout = () => {
                                targetDomRef.targetIndicatorElement.classList.remove('active');
                            };
                        }
                    });
                }
            },
            [ModalType.EXECUTION]: {
                title: '', // ★変更: ユーザーの指示によりタイトルを削除
                actorName: (data) => data.message,
                confirmButton: { text: 'OK' }
            },
            [ModalType.BATTLE_START_CONFIRM]: {
                title: '合意と見てよろしいですね！？', // ★変更: ユーザーの指示によりテキストを変更
                actorName: '', // ★追加: actorNameを空にすることで、タイトルとボタンの間の余白を詰める
                battleStartButton: true
            },
            [ModalType.GAME_OVER]: {
                title: (data) => `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
                actorName: 'ロボトル終了！',
                confirmButton: { text: 'リセット' }
            }
        };
    }

    // Worldからのイベントを購読する
    bindWorldEvents() {
        // ★変更: SHOW_MODAL/HIDE_MODALを新しいアクションパネル用のイベントに置き換え
        this.world.on(GameEvents.SHOW_MODAL, (detail) => this.showActionPanel(detail.type, detail.data));
        this.world.on(GameEvents.HIDE_MODAL, () => this.hideActionPanel());
        this.world.on(GameEvents.GAME_START_REQUESTED, () => this.showActionPanel(ModalType.START_CONFIRM));
        
        // ★追加: ゲームリセット時にUIの状態（パネルなど）をリセットする
        this.world.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));

        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, () => this.hideActionPanel());
    }

    // DOM要素のイベントリスナーを登録する
    bindDOMEvents() {
        // ★変更: ハンドラをプロパティに保存してから登録
        this.handlers.gameStart = () => {
            this.world.emit(GameEvents.GAME_START_REQUESTED);
        };
        this.dom.gameStartButton.addEventListener('click', this.handlers.gameStart);

        // ★変更: バトル開始ボタンの参照をアクションパネル内のものに更新
        this.handlers.battleStart = () => {
            this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
        };
        this.dom.actionPanelBattleStartButton.addEventListener('click', this.handlers.battleStart);

        // ★変更: 確認ボタンの参照とハンドラ名を更新
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

    // ★削除: createPlayerDOMメソッドはDomFactorySystemに移管されました。

    /**
     * ★変更: メソッド名をresetUIからresetViewに変更し、責務をUIの状態リセットに限定。
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

    // --- ★変更: アクションパネル表示/非表示 (旧モーダル) ---

    showActionPanel(type, data) {
        // ★変更: panelConfigs を参照
        const config = this.panelConfigs[type];
        if (!config) {
            this.hideActionPanel();
            return;
        }

        // ★変更: isPausedByModal は isPausedByPanel のような意味で引き続き利用
        this.context.isPausedByModal = true;
        
        if (type === ModalType.EXECUTION) {
            this.confirmActionEntityId = data.entityId;
        }

        // ★変更: ownerNameをSELECTIONの場合のみ設定
        if (type === ModalType.SELECTION) {
            this.dom.actionPanelOwner.textContent = data.ownerName || '';
        }

        // ★変更: DOM参照をアクションパネルのものに更新
        const { actionPanelTitle, actionPanelActor, actionPanelButtons, actionPanelConfirmButton, actionPanelBattleStartButton } = this.dom;

        const getValue = (value) => typeof value === 'function' ? value(data) : value;

        actionPanelTitle.textContent = getValue(config.title) || '';
        actionPanelActor.textContent = getValue(config.actorName) || '';
        actionPanelButtons.innerHTML = getValue(config.contentHTML) || '';
        
        actionPanelConfirmButton.style.display = 'none';
        actionPanelBattleStartButton.style.display = 'none';

        if (config.setupEvents) {
            // ★変更: ボタンコンテナとして actionPanelButtons を渡す
            config.setupEvents(actionPanelButtons, data);
        }

        if (config.confirmButton) {
            actionPanelConfirmButton.textContent = getValue(config.confirmButton.text);
            actionPanelConfirmButton.style.display = 'inline-block';
        }
        if (config.battleStartButton) {
            actionPanelBattleStartButton.style.display = 'inline-block';
        }

        // ★削除: パネルは常に表示されているため、hiddenクラスの操作は不要
    }

    hideActionPanel() {
        // ★変更: isPausedByModal を解除
        this.context.isPausedByModal = false;
        this.confirmActionEntityId = null;

        // 表示されている可能性のあるインジケーターを非表示にする
        const activeIndicator = document.querySelector('.target-indicator.active');
        if (activeIndicator) {
            activeIndicator.classList.remove('active');
        }

        // ★変更: actionPanelを非表示にする代わりに、内容をクリアする
        this.dom.actionPanelOwner.textContent = ''; // ★新規: ownerもクリア
        this.dom.actionPanelTitle.textContent = '';
        this.dom.actionPanelActor.textContent = '待機中...'; // デフォルトメッセージ
        this.dom.actionPanelButtons.innerHTML = '';
        this.dom.actionPanelConfirmButton.style.display = 'none';
        this.dom.actionPanelBattleStartButton.style.display = 'none';
    }
}
