// scripts/systems/uiSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { PlayerInfo, DOMReference, Parts, GameContext } from '../components.js';
import { TeamID } from '../constants.js';

export class UiSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);

        this.dom = {
            startButton: document.getElementById('startButton'),
            resetButton: document.getElementById('resetButton'),
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
    }

    // DOM要素のイベントリスナーを登録する
    bindDOMEvents() {
        this.dom.startButton.addEventListener('click', () => {
            this.world.emit(GameEvents.START_BUTTON_CLICKED);
        });

        this.dom.resetButton.addEventListener('click', () => {
            this.world.emit(GameEvents.RESET_BUTTON_CLICKED);
        });

        this.dom.battleStartConfirmButton.addEventListener('click', () => {
            this.world.emit(GameEvents.BATTLE_START_CONFIRMED);
        });

        this.dom.modalConfirmButton.addEventListener('click', () => {
            if (this.context.phase === 'game_over') {
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
        let partsHTML = '';
        Object.keys(parts).forEach(key => {
            partsHTML += `<div id="player-${entityId}-${key}-part" class="part-hp"></div>`;
        });
        info.innerHTML = `
            <div class="player-name ${teamConfig.textColor}">${playerInfo.name} ${playerInfo.isLeader ? '(L)' : ''}</div>
            <div class="parts-container">${partsHTML}</div>
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
        
        const panel = document.getElementById(`${playerInfo.teamId}InfoPanel`);
        panel.appendChild(info);
        domRef.infoPanel = info;
    }

    resetUI() {
        // バトルフィールドと情報パネルをクリア
        this.dom.battlefield.innerHTML = '<div class="center-line"></div>';
        Object.entries(CONFIG.TEAMS).forEach(([teamId, teamConfig]) => {
            const panel = document.getElementById(`${teamId}InfoPanel`);
            panel.innerHTML = `<h2 class="text-xl font-bold mb-3 ${teamConfig.textColor}">${teamConfig.name}</h2>`;
        });
        // ボタンの状態を初期化
        this.dom.startButton.disabled = false;
        this.dom.startButton.textContent = "シミュレーション開始";
        this.dom.resetButton.style.display = "none";
        this.hideModal();
    }

    update(deltaTime) {
        // このシステムはイベント駆動が主だが、UIの更新（ボタンの有効/無効など）はここで行う
        this.dom.startButton.disabled = this.context.phase !== 'IDLE';
        this.dom.startButton.textContent = this.context.phase === 'IDLE' ? "シミュレーション開始" : "シミュレーション中...";
        this.dom.resetButton.style.display = this.context.phase !== 'IDLE' ? "inline-block" : "none";
    }

    showModal(type, data) {
        const { modalTitle: title, modalActorName: actorName, partSelectionContainer: partContainer, modalConfirmButton: confirmBtn, battleStartConfirmButton: startBtn } = this.dom;
        
        // 全ての可変要素を一旦非表示に
        [partContainer, confirmBtn, startBtn].forEach(el => el.style.display = 'none');
        actorName.textContent = ''; // メッセージもクリア

        switch (type) {
            case 'selection':
                title.textContent = data.title;
                actorName.textContent = data.actorName;
                partContainer.innerHTML = ''; // ボタンをクリア
                
                // 選択肢ボタンを生成
                data.buttons.forEach(buttonInfo => {
                    const button = document.createElement('button');
                    button.className = 'part-action-button';
                    button.textContent = buttonInfo.text;
                    button.onclick = () => {
                        // どのプレイヤーがどのパーツを選んだか、イベントで通知
                        this.world.emit(GameEvents.ACTION_SELECTED, { entityId: data.entityId, partKey: buttonInfo.partKey });
                    };
                    partContainer.appendChild(button);
                });

                partContainer.style.display = 'flex';
                break;

            case 'execution':
                title.textContent = '攻撃実行！';
                actorName.textContent = data.message;
                confirmBtn.style.display = 'inline-block';
                confirmBtn.textContent = 'OK';
                break;

            case 'battle_start_confirm':
                title.textContent = '戦闘開始！';
                startBtn.style.display = 'inline-block';
                break;

            case 'game_over':
                title.textContent = `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`;
                actorName.textContent = 'ロボトル終了！';
                confirmBtn.style.display = 'inline-block';
                confirmBtn.textContent = 'リセット';
                break;
        }
        this.dom.modal.classList.remove('hidden');
    }

    hideModal() {
        this.dom.modal.classList.add('hidden');
    }
}
