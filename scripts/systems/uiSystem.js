// scripts/systems/uiSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { PlayerInfo, DOMReference, Parts, GameContext } from '../components.js';
import { TeamID, GamePhaseType } from '../constants.js';

export class UiSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);

        this.dom = {
            gameStartButton: document.getElementById('gameStartButton'), // ★変更: 新しい開始ボタン
            battlefield: document.getElementById('battlefield'),
            modal: document.getElementById('actionModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalActorName: document.getElementById('modalActorName'),
            partSelectionContainer: document.getElementById('partSelectionContainer'),
            modalConfirmButton: document.getElementById('modalConfirmButton'),
            battleStartConfirmButton: document.getElementById('battleStartConfirmButton')
        };
        this.bindWorldEvents();
        this.bindDOMEvents(); // DOMイベントのリスナー登録を分離
    }

    // Worldからのイベントを購読する
    bindWorldEvents() {
        this.world.on(GameEvents.SHOW_MODAL, (detail) => this.showModal(detail.type, detail.data));
        this.world.on(GameEvents.HIDE_MODAL, () => this.hideModal());
        // ★追加: ゲーム開始要求を受けたら、確認モーダルを表示する
        this.world.on(GameEvents.GAME_START_REQUESTED, () => this.showModal('start_confirm'));
    }

    // DOM要素のイベントリスナーを登録する
    bindDOMEvents() {
        // ★変更: 新しい開始アイコンボタンのクリックイベント
        this.dom.gameStartButton.addEventListener('click', () => {
            this.world.emit(GameEvents.GAME_START_REQUESTED);
        });

        this.dom.battleStartConfirmButton.addEventListener('click', () => {
            this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
        });

        this.dom.modalConfirmButton.addEventListener('click', () => {
            if (this.context.phase === GamePhaseType.GAME_OVER) {
                this.world.emit(GameEvents.RESET_BUTTON_CLICKED);
                return;
            }
            
            if (this.context.activePlayer !== null) {
                this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: this.context.activePlayer });
            }
        });
    }

    createPlayerDOM(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const domRef = this.world.getComponent(entityId, DOMReference);
        const parts = this.world.getComponent(entityId, Parts);

        // プレイヤーアイコンの生成
        const icon = document.createElement('div');
        icon.id = `player-${entityId}-icon`;
        icon.className = 'player-icon';
        icon.style.backgroundColor = playerInfo.color;
        icon.textContent = playerInfo.name.substring(playerInfo.name.length - 1);
        domRef.iconElement = icon;
        this.dom.battlefield.appendChild(icon);

        // 情報パネル内のプレイヤー情報UIを生成
        const info = document.createElement('div');
        info.className = 'player-info';
        const teamConfig = CONFIG.TEAMS[playerInfo.teamId];

        // ★変更: 縦並びにするため、parts-container を使わず直接HTMLを構築
        let partsHTML = '';
        Object.keys(parts).forEach(key => {
            partsHTML += `<div id="player-${entityId}-${key}-part" class="part-hp"></div>`;
        });

        info.innerHTML = `
            <div class="player-name ${teamConfig.textColor}">${playerInfo.name} ${playerInfo.isLeader ? '(L)' : ''}</div>
            ${partsHTML}
        `;
        
        // 各パーツのDOM要素への参照を保存
        Object.entries(parts).forEach(([key, part]) => {
            const partEl = info.querySelector(`#player-${entityId}-${key}-part`);
            partEl.innerHTML = `
                <span class="part-name">${part.name.substring(0,1)}</span>
                <div class="part-hp-bar-container"><div class="part-hp-bar"></div></div>
            `;
            domRef.partDOMElements[key] = {
                container: partEl,
                name: partEl.querySelector('.part-name'),
                bar: partEl.querySelector('.part-hp-bar')
            };
        });
        
        // ★変更: 新しく作ったチーム別プレイヤーコンテナに追加
        const panel = document.querySelector(`#${playerInfo.teamId}InfoPanel .team-players-container`);
        panel.appendChild(info);
        domRef.infoPanel = info;
    }

    resetUI() {
        // バトルフィールドと情報パネルをクリア
        this.dom.battlefield.innerHTML = '<div class="center-line"></div>';
        Object.entries(CONFIG.TEAMS).forEach(([teamId, teamConfig]) => {
            const panel = document.getElementById(`${teamId}InfoPanel`);
            // ★変更: プレイヤー情報を格納するコンテナを追加
            panel.innerHTML = `
                <h2 class="text-xl font-bold mb-3 ${teamConfig.textColor}">${teamConfig.name}</h2>
                <div class="team-players-container"></div>
            `;
        });
        // ★変更: ボタンの状態を初期化
        this.dom.gameStartButton.style.display = "flex"; // 開始アイコンを表示
        this.hideModal();
    }

    update(deltaTime) {
        // ゲームが開始されていないアイドル状態の場合のみ、ゲーム開始ボタンを表示します。
        this.dom.gameStartButton.style.display = this.context.phase === 'IDLE' ? "flex" : "none";
    }

    // --- モーダル表示/非表示 ---

    /**
     * ★変更: モーダル表示のメインロジック。
     * 種類に応じて、それぞれのモーダルコンテンツを生成するプライベートメソッドを呼び出します。
     * @param {string} type - モーダルの種類
     * @param {object} [data] - モーダルに渡すデータ
     */
    showModal(type, data) {
        const { modalTitle, modalActorName, partSelectionContainer, modalConfirmButton, battleStartConfirmButton } = this.dom;
        
        // 全ての可変要素を一旦リセット
        [partSelectionContainer, modalConfirmButton, battleStartConfirmButton].forEach(el => el.style.display = 'none');
        partSelectionContainer.innerHTML = '';
        modalActorName.textContent = '';

        // ★追加: モーダルの種類に応じてコンテンツを生成・設定
        let modalContent;
        switch (type) {
            case 'start_confirm':
                modalContent = this._createStartConfirmModal();
                break;
            case 'selection':
                modalContent = this._createSelectionModal(data);
                break;
            case 'execution':
                modalContent = this._createExecutionModal(data);
                break;
            case 'battle_start_confirm':
                modalContent = this._createBattleStartConfirmModal();
                break;
            case 'game_over':
                modalContent = this._createGameOverModal(data);
                break;
            default:
                // 不明なモーダルタイプの場合は何も表示しない
                this.hideModal();
                return;
        }

        // 生成されたコンテンツをモーダルに適用
        modalTitle.textContent = modalContent.title;
        if (modalContent.actorName) modalActorName.textContent = modalContent.actorName;
        if (modalContent.contentElement) {
            partSelectionContainer.appendChild(modalContent.contentElement);
            partSelectionContainer.style.display = 'flex';
        }
        if (modalContent.confirmButton) {
            modalConfirmButton.textContent = modalContent.confirmButton.text;
            modalConfirmButton.style.display = 'inline-block';
        }
        if (modalContent.battleStartButton) {
            battleStartConfirmButton.style.display = 'inline-block';
        }

        this.dom.modal.classList.remove('hidden');
    }

    hideModal() {
        this.dom.modal.classList.add('hidden');
    }

    // --- モーダルコンテンツ生成メソッド群 ---

    /**
     * ★追加: ゲーム開始確認モーダルのコンテンツを生成します。
     * @returns {object} モーダルに表示するタイトルとDOM要素
     */
    _createStartConfirmModal() {
        const content = document.createElement('div');
        content.className = 'buttons-center';

        const yesButton = this._createButton('はい', 'modal-button', () => {
            this.world.emit(GameEvents.GAME_START_CONFIRMED);
            this.hideModal();
        });

        const noButton = this._createButton('いいえ', 'modal-button bg-red-500 hover:bg-red-600', () => this.hideModal());

        content.appendChild(yesButton);
        content.appendChild(noButton);

        return {
            title: 'ロボトル開始',
            actorName: 'シミュレーションを開始しますか？',
            contentElement: content
        };
    }

    /**
     * ★追加: 行動選択モーダルのコンテンツを生成します。
     * @param {object} data - 選択肢ボタンの情報
     * @returns {object} モーダルに表示するタイトル、アクタ名、DOM要素
     */
    _createSelectionModal(data) {
        const content = document.createElement('div');
        content.className = 'buttons-center gap-4 flex-col';

        data.buttons.forEach(buttonInfo => {
            const button = this._createButton(buttonInfo.text, 'part-action-button', () => {
                this.world.emit(GameEvents.ACTION_SELECTED, { entityId: data.entityId, partKey: buttonInfo.partKey });
            });
            content.appendChild(button);
        });

        return {
            title: data.title,
            actorName: data.actorName,
            contentElement: content
        };
    }

    /**
     * ★追加: 攻撃実行モーダルのコンテンツを生成します。
     * @param {object} data - 表示するメッセージ
     * @returns {object} モーダルに表示するタイトル、メッセージ、確認ボタンの情報
     */
    _createExecutionModal(data) {
        return {
            title: '攻撃実行！',
            actorName: data.message,
            confirmButton: { text: 'OK' }
        };
    }

    /**
     * ★追加: 戦闘開始確認モーダルのコンテンツを生成します。
     * @returns {object} モーダルに表示するタイトルと戦闘開始ボタンの情報
     */
    _createBattleStartConfirmModal() {
        return {
            title: '戦闘開始！',
            battleStartButton: true
        };
    }

    /**
     * ★追加: ゲームオーバーモーダルのコンテンツを生成します。
     * @param {object} data - 勝者チームの情報
     * @returns {object} モーダルに表示するタイトル、メッセージ、確認ボタンの情報
     */
    _createGameOverModal(data) {
        return {
            title: `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
            actorName: 'ロボトル終了！',
            confirmButton: { text: 'リセット' }
        };
    }

    /**
     * ★追加: ボタン要素を生成するヘルパーメソッド。
     * @param {string} text - ボタンのテキスト
     * @param {string} className - ボタンに適用するCSSクラス
     * @param {function} onClick - クリック時のコールバック関数
     * @returns {HTMLButtonElement} 生成されたボタン要素
     */
    _createButton(text, className, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = className;
        button.onclick = onClick;
        return button;
    }
}
