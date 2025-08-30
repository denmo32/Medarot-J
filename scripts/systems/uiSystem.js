// scripts/systems/uiSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
// GamePhaseコンポーネントは不要になったので削除
import { PlayerInfo, DOMReference, Parts } from '../components.js';
import { TeamID } from '../constants.js';

export class UiSystem {
    constructor(world) {
        this.world = world;
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
        this.bindWorldEvents(); // イベントリスナーを登録
    }

    // Worldからのイベントを購読する
    bindWorldEvents() {
        // document.addEventListenerの代わりにworld.onを使用
        this.world.on(GameEvents.SHOW_MODAL, (detail) => {
            this.showModal(detail.type, detail.data);
        });
        this.world.on(GameEvents.HIDE_MODAL, () => {
            this.hideModal();
        });
        // 攻撃実行が確定したらモーダルを閉じる
        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, () => {
            this.hideModal();
        });
    }

    createPlayerDOM(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const domRef = this.world.getComponent(entityId, DOMReference);
        const parts = this.world.getComponent(entityId, Parts);

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
            <div class="parts-container">${partsHTML}</div>
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
        
        const panel = document.getElementById(`${playerInfo.teamId}InfoPanel`);
        panel.appendChild(info);
        domRef.infoPanel = info;
    }

    resetUI() {
        this.dom.battlefield.innerHTML = '<div class="center-line"></div>';
        Object.entries(CONFIG.TEAMS).forEach(([teamId, teamConfig]) => {
            const panel = document.getElementById(`${teamId}InfoPanel`);
            panel.innerHTML = `<h2 class="text-xl font-bold mb-3 ${teamConfig.textColor}">${teamConfig.name}</h2>`;
        });
        this.dom.startButton.disabled = false;
        this.dom.startButton.textContent = "シミュレーション開始";
        this.dom.resetButton.style.display = "none";
        this.hideModal();
    }

    update(deltaTime) {
        // このシステムはイベント駆動なので、updateループで何かをする必要はない
    }

    showModal(type, data) {
        // world.gamePhaseを直接参照
        this.world.gamePhase.isModalActive = true;
        
        const { modalTitle: title, modalActorName: actorName, partSelectionContainer: partContainer, modalConfirmButton: confirmBtn, battleStartConfirmButton: startBtn } = this.dom;
        
        [partContainer, confirmBtn, startBtn].forEach(el => el.style.display = 'none');
        this.dom.modal.className = 'modal';

        switch (type) {
            case 'selection':
                title.textContent = data.title;
                actorName.textContent = data.actorName;
                partContainer.innerHTML = '';
                
                data.buttons.forEach(buttonInfo => {
                    const button = document.createElement('button');
                    button.className = 'part-action-button';
                    button.textContent = buttonInfo.text;
                    button.onclick = () => {
                        // world.emitを使ってイベントを発行
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
                actorName.textContent = '';
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
        // world.gamePhaseを直接参照
        this.world.gamePhase.isModalActive = false;
        this.dom.modal.classList.add('hidden');
    }
}
