// scripts/systems/uiSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { PlayerInfo, DOMReference, Parts, GameContext, Position } from '../components.js'; // ★変更: Positionコンポーネントをインポート
import { TeamID, GamePhaseType } from '../constants.js';

export class UiSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        this.context = this.world.getSingletonComponent(GameContext);

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
        const position = this.world.getComponent(entityId, Position); // Y座標の取得に必要

        // ホームポジションのX座標をconfigから取得
        const homeX = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
            : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;

        // ホームポジションを示すマーカーを生成
        const marker = document.createElement('div');
        marker.className = 'home-marker';
        marker.style.left = `${homeX * 100}%`;
        marker.style.top = `${position.y}%`; // プレイヤーのY座標に合わせる
        domRef.homeMarkerElement = marker;
        this.dom.battlefield.appendChild(marker);

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
        this.dom.battlefield.innerHTML = '<div class="action-line-1"></div><div class="action-line-2"></div>';
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
     * ★変更: モーダル表示のロジックを単一化。
     * 種類とデータに応じて設定オブジェクトを構築し、それに基づいてDOMを生成します。
     * @param {string} type - モーダルの種類 (e.g., 'start_confirm', 'selection')
     * @param {object} [data] - モーダルに渡すデータ
     */
    showModal(type, data) {
        const { modalTitle, modalActorName, partSelectionContainer, modalConfirmButton, battleStartConfirmButton } = this.dom;
        
        // --- 1. モーダル設定の定義 ---
        let config = {
            title: '',
            actorName: '',
            contentHTML: '',
            confirmButton: null, // { text, onClick }
            battleStartButton: false,
        };

        // モーダルの種類に応じて設定を構築
        switch (type) {
            case 'start_confirm':
                config.title = 'ロボトル開始';
                config.actorName = 'シミュレーションを開始しますか？';
                config.contentHTML = `
                    <div class="buttons-center">
                        <button id="modalBtnYes" class="modal-button">はい</button>
                        <button id="modalBtnNo" class="modal-button bg-red-500 hover:bg-red-600">いいえ</button>
                    </div>`;
                break;

            case 'selection':
                config.title = data.title;
                config.actorName = data.actorName;
                config.contentHTML = data.buttons.map((btn, index) => 
                    `<button id="modalBtnPart${index}" class="part-action-button">${btn.text}</button>`
                ).join('');
                break;

            case 'execution':
                config.title = '攻撃実行！';
                config.actorName = data.message;
                config.confirmButton = { text: 'OK' };
                break;

            case 'battle_start_confirm':
                config.title = '戦闘開始！';
                config.battleStartButton = true;
                break;

            case 'game_over':
                config.title = `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`;
                config.actorName = 'ロボトル終了！';
                config.confirmButton = { text: 'リセット' };
                break;

            default:
                this.hideModal();
                return;
        }

        // --- 2. DOMの構築とイベント設定 ---

        // 全ての可変要素を一旦リセット
        modalTitle.textContent = config.title;
        modalActorName.textContent = config.actorName;
        partSelectionContainer.innerHTML = config.contentHTML;
        modalConfirmButton.style.display = 'none';
        battleStartConfirmButton.style.display = 'none';

        // コンテンツ内のボタンにイベントリスナーを設定
        if (type === 'start_confirm') {
            partSelectionContainer.querySelector('#modalBtnYes').onclick = () => {
                this.world.emit(GameEvents.GAME_START_CONFIRMED);
                this.hideModal();
            };
            partSelectionContainer.querySelector('#modalBtnNo').onclick = () => this.hideModal();
        }
        if (type === 'selection') {
            data.buttons.forEach((btn, index) => {
                partSelectionContainer.querySelector(`#modalBtnPart${index}`).onclick = () => {
                    this.world.emit(GameEvents.ACTION_SELECTED, { entityId: data.entityId, partKey: btn.partKey });
                };
            });
        }

        // 固定ボタンの表示と設定
        if (config.confirmButton) {
            modalConfirmButton.textContent = config.confirmButton.text;
            modalConfirmButton.style.display = 'inline-block';
        }
        if (config.battleStartButton) {
            battleStartConfirmButton.style.display = 'inline-block';
        }

        this.dom.modal.classList.remove('hidden');
    }

    hideModal() {
        this.dom.modal.classList.add('hidden');
    }

    /**
     * ★維持: このヘルパーメソッドは、動的にボタンを追加する必要がなくなったため、削除します。
     * ボタンの生成はshowModal内のテンプレートリテラルで行われます。
     */
    // _createButton(...) は不要になったため削除
}
