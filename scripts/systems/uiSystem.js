// scripts/systems/uiSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { GamePhase, PlayerInfo, DOMReference, Parts, GameState, Action } from '../components.js';
import { PartType } from '../constants.js';

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
        this.bindModalEvents(); // イベントリスナーを登録
    }

    // イベントリスナーを登録するメソッド
    bindModalEvents() {
        document.addEventListener(GameEvents.SHOW_SELECTION_MODAL, ({ detail }) => {
            this.showModal('selection', detail);
        });
        document.addEventListener(GameEvents.SHOW_EXECUTION_MODAL, ({ detail }) => {
            this.showModal('execution', detail);
        });
        document.addEventListener(GameEvents.SHOW_BATTLE_START_MODAL, ({ detail }) => {
            this.showModal('battle_start_confirm', detail);
        });
        document.addEventListener(GameEvents.SHOW_GAME_OVER_MODAL, ({ detail }) => {
            this.showModal('game_over', detail);
        });
    }

    createPlayerDOM(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const domRef = this.world.getComponent(entityId, DOMReference);
        const parts = this.world.getComponent(entityId, Parts);

        // アイコン作成
        const icon = document.createElement('div');
        icon.id = `player-${entityId}-icon`;
        icon.className = 'player-icon';
        icon.style.backgroundColor = playerInfo.color;
        icon.textContent = playerInfo.name.substring(playerInfo.name.length - 1);
        domRef.iconElement = icon;
        this.dom.battlefield.appendChild(icon);

        // 情報パネル作成
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
        // モーダル表示はイベント駆動になったため、このメソッドからはロジックを削除
    }

    showModal(type, data) {
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        if (gamePhaseEntity) {
            const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);
            if (gamePhase) gamePhase.isModalActive = true;
        }
        const { modalTitle: title, modalActorName: actorName, partSelectionContainer: partContainer, modalConfirmButton: confirmBtn, battleStartConfirmButton: startBtn } = this.dom;
        
        [partContainer, confirmBtn, startBtn].forEach(el => el.style.display = 'none');
        this.dom.modal.className = 'modal';

        switch (type) {
            case 'selection':
                // 提案3: InputSystemから渡されたデータに基づいてモーダルを構築する
                title.textContent = data.title;
                actorName.textContent = data.actorName;
                partContainer.innerHTML = '';
                
                // ゲームロジック（どのパーツが使えるか等）の判定はここからなくなり、
                // 渡されたボタン情報を元に描画するだけの責務に集中する
                data.buttons.forEach(buttonInfo => {
                    const button = document.createElement('button');
                    button.className = 'part-action-button';
                    button.textContent = buttonInfo.text;
                    button.onclick = () => {
                        // main.js にイベント処理を移譲
                        document.dispatchEvent(new CustomEvent(GameEvents.ACTION_SELECTED, { detail: { entityId: data.entityId, partKey: buttonInfo.partKey } }));
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
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        if (gamePhaseEntity) {
            const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);
            if (gamePhase) gamePhase.isModalActive = false;
        }
        this.dom.modal.classList.add('hidden');
    }
}