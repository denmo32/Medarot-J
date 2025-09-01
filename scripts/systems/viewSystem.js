// scripts/systems/viewSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import * as Components from '../components.js';
import { TeamID, GamePhaseType, ModalType } from '../constants.js';

/**
 * ★クラス名変更: UiSystem -> ViewSystem
 * ユーザーインタラクション（モーダル表示、ボタンイベントなど）とUIの状態管理に責務を特化させたシステム。
 * DOM要素の生成はDomFactorySystemに分離されました。
 */
export class ViewSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(Components.GameContext);

        this.confirmActionEntityId = null;

        this.dom = {
            gameStartButton: document.getElementById('gameStartButton'),
            modal: document.getElementById('actionModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalActorName: document.getElementById('modalActorName'),
            partSelectionContainer: document.getElementById('partSelectionContainer'),
            modalConfirmButton: document.getElementById('modalConfirmButton'),
            battleStartConfirmButton: document.getElementById('battleStartConfirmButton')
        };

        // --- ★追加: イベントハンドラを保持するプロパティ ---
        this.handlers = {
            gameStart: null,
            battleStart: null,
            modalConfirm: null
        };

        this.initializeModalConfigs();
        this.bindWorldEvents();
        this.bindDOMEvents();
        this.injectAnimationStyles();
    }

    // ★追加: クリーンアップメソッド
    destroy() {
        // 登録したDOMイベントリスナーを削除
        if (this.handlers.gameStart) {
            this.dom.gameStartButton.removeEventListener('click', this.handlers.gameStart);
        }
        if (this.handlers.battleStart) {
            this.dom.battleStartConfirmButton.removeEventListener('click', this.handlers.battleStart);
        }
        if (this.handlers.modalConfirm) {
            this.dom.modalConfirmButton.removeEventListener('click', this.handlers.modalConfirm);
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

    // モーダルの設定を初期化する
    initializeModalConfigs() {
        this.modalConfigs = {
            [ModalType.START_CONFIRM]: {
                title: 'ロボトル開始',
                actorName: 'シミュレーションを開始しますか？',
                contentHTML: `
                    <div class="buttons-center">
                        <button id="modalBtnYes" class="modal-button">はい</button>
                        <button id="modalBtnNo" class="modal-button bg-red-500 hover:bg-red-600">いいえ</button>
                    </div>`,
                setupEvents: (container) => {
                    container.querySelector('#modalBtnYes').onclick = () => {
                        this.world.emit(GameEvents.GAME_START_CONFIRMED);
                        this.hideModal();
                    };
                    container.querySelector('#modalBtnNo').onclick = () => this.hideModal();
                }
            },
            [ModalType.SELECTION]: {
                title: (data) => data.title,
                actorName: (data) => data.actorName,
                contentHTML: (data) => data.buttons.map((btn, index) => 
                    `<button id="modalBtnPart${index}" class="part-action-button">${btn.text}</button>`
                ).join(''),
                setupEvents: (container, data) => {
                    // 事前計算されたターゲットのDOM参照を取得
                    const targetDomRef = data.targetId !== null ? this.world.getComponent(data.targetId, Components.DOMReference) : null;

                    data.buttons.forEach((btn, index) => {
                        const buttonEl = container.querySelector(`#modalBtnPart${index}`);
                        if (!buttonEl) return;

                        // クリック時に、事前に計算したターゲット情報も一緒にイベント発行する
                        buttonEl.onclick = () => {
                            this.world.emit(GameEvents.PART_SELECTED, { 
                                entityId: data.entityId, 
                                partKey: btn.partKey,
                                targetId: data.targetId,
                                targetPartKey: data.targetPartKey
                            });
                            this.hideModal();
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
                title: '攻撃実行！',
                actorName: (data) => data.message,
                confirmButton: { text: 'OK' }
            },
            [ModalType.BATTLE_START_CONFIRM]: {
                title: '戦闘開始！',
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
        this.world.on(GameEvents.SHOW_MODAL, (detail) => this.showModal(detail.type, detail.data));
        this.world.on(GameEvents.HIDE_MODAL, () => this.hideModal());
        this.world.on(GameEvents.GAME_START_REQUESTED, () => this.showModal(ModalType.START_CONFIRM));
        
        // ★追加: ゲームリセット時にUIの状態（モーダルなど）をリセットする
        this.world.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));

        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, () => this.hideModal());
    }

    // DOM要素のイベントリスナーを登録する
    bindDOMEvents() {
        // ★変更: ハンドラをプロパティに保存してから登録
        this.handlers.gameStart = () => {
            this.world.emit(GameEvents.GAME_START_REQUESTED);
        };
        this.dom.gameStartButton.addEventListener('click', this.handlers.gameStart);

        this.handlers.battleStart = () => {
            this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
        };
        this.dom.battleStartConfirmButton.addEventListener('click', this.handlers.battleStart);

        this.handlers.modalConfirm = () => {
            if (this.context.phase === GamePhaseType.GAME_OVER) {
                this.world.emit(GameEvents.RESET_BUTTON_CLICKED);
                return;
            }
            
            if (this.confirmActionEntityId !== null) {
                this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: this.confirmActionEntityId });
            }
        };
        this.dom.modalConfirmButton.addEventListener('click', this.handlers.modalConfirm);
    }

    // ★削除: createPlayerDOMメソッドはDomFactorySystemに移管されました。

    /**
     * ★変更: メソッド名をresetUIからresetViewに変更し、責務をUIの状態リセットに限定。
     * DOM要素のクリアはDomFactorySystemが担当します。
     */
    resetView() {
        this.dom.gameStartButton.style.display = "flex";
        this.hideModal();
    }

    update(deltaTime) {
        // ゲーム開始ボタンの表示/非表示を管理
        this.dom.gameStartButton.style.display = this.context.phase === GamePhaseType.IDLE ? "flex" : "none";
    }

    // --- モーダル表示/非表示 ---

    showModal(type, data) {
        const config = this.modalConfigs[type];
        if (!config) {
            this.hideModal();
            return;
        }

        this.context.isPausedByModal = true;
        
        if (type === ModalType.EXECUTION) {
            this.confirmActionEntityId = data.entityId;
        }

        const { modalTitle, modalActorName, partSelectionContainer, modalConfirmButton, battleStartConfirmButton } = this.dom;

        const getValue = (value) => typeof value === 'function' ? value(data) : value;

        modalTitle.textContent = getValue(config.title) || '';
        modalActorName.textContent = getValue(config.actorName) || '';
        partSelectionContainer.innerHTML = getValue(config.contentHTML) || '';
        
        modalConfirmButton.style.display = 'none';
        battleStartConfirmButton.style.display = 'none';

        if (config.setupEvents) {
            config.setupEvents(partSelectionContainer, data);
        }

        if (config.confirmButton) {
            modalConfirmButton.textContent = getValue(config.confirmButton.text);
            modalConfirmButton.style.display = 'inline-block';
        }
        if (config.battleStartButton) {
            battleStartConfirmButton.style.display = 'inline-block';
        }

        this.dom.modal.classList.remove('hidden');
    }

    hideModal() {
        this.context.isPausedByModal = false;
        this.confirmActionEntityId = null;

        // 表示されている可能性のあるインジケーターを非表示にする
        const activeIndicator = document.querySelector('.target-indicator.active');
        if (activeIndicator) {
            activeIndicator.classList.remove('active');
        }

        this.dom.modal.classList.add('hidden');
    }
}