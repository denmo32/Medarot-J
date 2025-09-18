// scripts/systems/domFactorySystem.js:

import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components.js';
import { TeamID, PartType } from '../common/constants.js';

/**
 * DOM要素の生成、配置、削除に特化したシステム。
 * HTMLテンプレートを利用して、JavaScriptコードからHTML構造を分離します。
 * このシステムはイベント駆動であり、updateループを持ちません。
 */
export class DomFactorySystem {
    constructor(world) {
        this.world = world;
        
        // テンプレートとコンテナ要素への参照をキャッシュ
        this.playerInfoTemplate = document.getElementById('player-info-template');
        this.battlefield = document.getElementById('battlefield');
        this.teamContainers = {
            [TeamID.TEAM1]: document.querySelector('#team1InfoPanel .team-players-container'),
            [TeamID.TEAM2]: document.querySelector('#team2InfoPanel .team-players-container')
        };
        
        // UI構築とリセットのイベントをリッスン
        this.world.on(GameEvents.SETUP_UI_REQUESTED, this.onSetupUIRequested.bind(this));
        this.world.on(GameEvents.GAME_WILL_RESET, this.onGameWillReset.bind(this));
    }

    /**
     * UIのセットアップが要求された際のハンドラ。
     * 全てのプレイヤーエンティティに対応するDOM要素を生成・配置します。
     */
    onSetupUIRequested() {
        const playerEntities = this.world.getEntitiesWith(Components.PlayerInfo);
        for (const entityId of playerEntities) {
            this._createPlayerDOM(entityId);
        }
    }

    /**
     * ゲームのリセットが要求された際のハンドラ。
     * このシステムが生成した全てのDOM要素をクリアします。
     */
    onGameWillReset() {
        // バトルフィールドのアイコンとマーカーをクリア
        this.battlefield.innerHTML = '<div class="action-line-1"></div><div class="action-line-2"></div>';
        
        // 各チームの情報パネルをクリア
        Object.values(this.teamContainers).forEach(container => {
            container.innerHTML = '';
        });
    }

    /**
     * 単一のプレイヤーエンティティに対応するDOM要素を生成し、DOMツリーに追加します。
     * @param {number} entityId - 対象のエンティティID
     * @private
     */
    _createPlayerDOM(entityId) {
        const playerInfo = this.world.getComponent(entityId, Components.PlayerInfo);
        const domRef = this.world.getComponent(entityId, Components.DOMReference);
        const parts = this.world.getComponent(entityId, Components.Parts);
        const position = this.world.getComponent(entityId, Components.Position);
        const teamConfig = CONFIG.TEAMS[playerInfo.teamId];
        
        // --- 1. バトルフィールド上のアイコンとホームマーカーを生成 ---
        const homeX = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
            : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;

        const marker = document.createElement('div');
        marker.className = 'home-marker';
        marker.style.left = `${homeX * 100}%`;
        marker.style.top = `${position.y}%`;
        domRef.homeMarkerElement = marker;
        this.battlefield.appendChild(marker);

        const icon = document.createElement('div');
        icon.id = `player-${entityId}-icon`;
        icon.className = 'player-icon';
        icon.style.backgroundColor = playerInfo.color;
        icon.textContent = playerInfo.name.substring(playerInfo.name.length - 1);
        domRef.iconElement = icon;
        this.battlefield.appendChild(icon);

        // ターゲット表示用インジケーターをアイコンの子要素として生成
        const indicator = document.createElement('div');
        indicator.className = 'target-indicator';
        // レーダー風アニメーションのために4つの角要素を追加
        for (let i = 0; i < 4; i++) {
            const corner = document.createElement('div');
            corner.className = `corner corner-${i + 1}`;
            indicator.appendChild(corner);
        }
        domRef.targetIndicatorElement = indicator;
        icon.appendChild(indicator);

        // --- 2. プレイヤー情報パネルをテンプレートから生成 ---
        const templateClone = this.playerInfoTemplate.content.cloneNode(true);
        const infoPanel = templateClone.querySelector('.player-info');
        
        // 名前とリーダー表示を設定
        const nameEl = infoPanel.querySelector('.player-name');
        nameEl.textContent = `${playerInfo.name}`;        nameEl.className = `player-name ${teamConfig.textColor}`;

        // ★新規: パーツの部位を表す絵文字のマッピング
        const partIcons = {
            [PartType.HEAD]: '👤',
            [PartType.RIGHT_ARM]: '🫷',
            [PartType.LEFT_ARM]: '🫸',
            [PartType.LEGS]: '👣'
        };

        // 各パーツの情報を設定し、DOM参照をキャッシュ
        Object.entries(parts).forEach(([key, part]) => {
            const partEl = infoPanel.querySelector(`[data-part-key="${key}"]`);
            const partNameEl = partEl.querySelector('.part-name');
            partNameEl.textContent = partIcons[key] || '?'; // ★変更: 絵文字を表示
            
            domRef.partDOMElements[key] = {
                container: partEl,
                name: partNameEl,
                bar: partEl.querySelector('.part-hp-bar')
            };
        });

        // 生成した情報パネルを対応するチームのコンテナに追加
        this.teamContainers[playerInfo.teamId].appendChild(infoPanel);
        domRef.infoPanel = infoPanel;
    }

    // このシステムはイベント駆動なのでupdateは不要
    update(deltaTime) {}
}