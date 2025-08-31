// scripts/systems/uiSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { PlayerInfo, DOMReference, Parts, GameContext, Position } from '../components.js'; // ★変更: Positionコンポーネントをインポート
// ★変更: ModalTypeを追加でインポート
import { TeamID, GamePhaseType, ModalType } from '../constants.js';

export class UiSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(GameContext);

        this.dom = {
            gameStartButton: document.getElementById('gameStartButton'),
            battlefield: document.getElementById('battlefield'),
            modal: document.getElementById('actionModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalActorName: document.getElementById('modalActorName'),
            partSelectionContainer: document.getElementById('partSelectionContainer'),
            modalConfirmButton: document.getElementById('modalConfirmButton'),
            battleStartConfirmButton: document.getElementById('battleStartConfirmButton')
        };

        this.initializeModalConfigs();
        this.bindWorldEvents();
        this.bindDOMEvents();
    }

    // モーダルの設定を初期化する
    initializeModalConfigs() {
        // ★変更: モーダル設定のキーをマジックストリングからModalType定数に変更
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
                    data.buttons.forEach((btn, index) => {
                        container.querySelector(`#modalBtnPart${index}`).onclick = () => {
                            // ★変更: プレイヤーによるパーツ選択を通知する、より具体的なイベントを発行します。
                            // これにより、UIの責務（入力の受付）とDecisionSystemの責務（ターゲット決定）を分離します。
                            this.world.emit(GameEvents.PART_SELECTED, { entityId: data.entityId, partKey: btn.partKey });
                            // ★追加: 選択後、即座にモーダルを閉じることで操作感を向上させます。
                            this.hideModal();
                        };
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
        // ★変更: マジックストリングを定数に変更
        this.world.on(GameEvents.GAME_START_REQUESTED, () => this.showModal(ModalType.START_CONFIRM));
        
        // ★追加: activePlayerの管理をUiSystemに集約するため、関連イベントを購読
        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, () => this.hideModal());
        this.world.on(GameEvents.ACTION_SELECTED, () => this.hideModal());
    }

    // DOM要素のイベントリスナーを登録する
    bindDOMEvents() {
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

        const homeX = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
            : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;

        const marker = document.createElement('div');
        marker.className = 'home-marker';
        marker.style.left = `${homeX * 100}%`;
        marker.style.top = `${position.y}%`;
        domRef.homeMarkerElement = marker;
        this.dom.battlefield.appendChild(marker);

        const icon = document.createElement('div');
        icon.id = `player-${entityId}-icon`;
        icon.className = 'player-icon';
        icon.style.backgroundColor = playerInfo.color;
        icon.textContent = playerInfo.name.substring(playerInfo.name.length - 1);
        domRef.iconElement = icon;
        this.dom.battlefield.appendChild(icon);

        const info = document.createElement('div');
        info.className = 'player-info';
        const teamConfig = CONFIG.TEAMS[playerInfo.teamId];

        let partsHTML = '';
        Object.keys(parts).forEach(key => {
            partsHTML += `<div id="player-${entityId}-${key}-part" class="part-hp"></div>`;
        });

        info.innerHTML = `
            <div class="player-name ${teamConfig.textColor}">${playerInfo.name} ${playerInfo.isLeader ? '(L)' : ''}</div>
            ${partsHTML}
        `;
        
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
        
        const panel = document.querySelector(`#${playerInfo.teamId}InfoPanel .team-players-container`);
        panel.appendChild(info);
        domRef.infoPanel = info;
    }

    resetUI() {
        this.dom.battlefield.innerHTML = '<div class="action-line-1"></div><div class="action-line-2"></div>';
        Object.entries(CONFIG.TEAMS).forEach(([teamId, teamConfig]) => {
            const panel = document.getElementById(`${teamId}InfoPanel`);
            panel.innerHTML = `
                <h2 class="text-xl font-bold mb-3 ${teamConfig.textColor}">${teamConfig.name}</h2>
                <div class="team-players-container"></div>
            `;
        });
        this.dom.gameStartButton.style.display = "flex";
        this.hideModal();
    }

    update(deltaTime) {
        this.dom.gameStartButton.style.display = this.context.phase === 'IDLE' ? "flex" : "none";
    }

    // --- モーダル表示/非表示 ---

    showModal(type, data) {
        const config = this.modalConfigs[type];
        if (!config) {
            this.hideModal();
            return;
        }

        // ★追加: モーダル表示時にactivePlayerを設定する責務をここに集約
        if (type === ModalType.SELECTION || type === ModalType.EXECUTION) {
            this.context.activePlayer = data.entityId;
        }

        const { modalTitle, modalActorName, partSelectionContainer, modalConfirmButton, battleStartConfirmButton } = this.dom;

        // --- DOMの構築とイベント設定 ---
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
        // ★追加: モーダル非表示時にactivePlayerを解除する責務をここに集約
        if (this.context.activePlayer !== null) {
            this.context.activePlayer = null;
        }
        this.dom.modal.classList.add('hidden');
    }
}