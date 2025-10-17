import { BaseSystem } from '../../core/baseSystem.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { TeamID, PartKeyToInfoMap, PartInfo } from '../common/constants.js';
import { UIManager } from './UIManager.js';

/**
 * DOM要素の生成、配置、削除に特化したシステム。
 * HTMLテンプレートを利用して、JavaScriptコードからHTML構造を分離します。
 * このシステムはイベント駆動であり、updateループを持ちません。
 */
export class DomFactorySystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        
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

        //  UIManagerにキャッシュされているDOM要素への参照もすべてクリアする
        // これにより、メモリリークを防ぎ、次のバトルでUIが重複生成される問題を完全に解決する
        if (this.uiManager) {
            this.uiManager.clear();
        }
    }

    /**
     * 単一のプレイヤーエンティティに対応するDOM要素を生成し、DOMツリーに追加します。
     * @param {number} entityId - 対象のエンティティID
     * @private
     */
    _createPlayerDOM(entityId) {
        const playerInfo = this.world.getComponent(entityId, Components.PlayerInfo);
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
        this.battlefield.appendChild(marker);

        const icon = document.createElement('div');
        icon.id = `player-${entityId}-icon`;
        icon.className = 'player-icon';
        icon.style.backgroundColor = playerInfo.color;
        icon.textContent = playerInfo.name.substring(playerInfo.name.length - 1);
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
        icon.appendChild(indicator);

        // ガード状態表示用のインジケーターを生成
        const guardIndicator = document.createElement('div');
        guardIndicator.className = 'guard-indicator';
        icon.appendChild(guardIndicator);

        // --- 2. プレイヤー情報パネルをテンプレートから生成 ---
        const templateClone = this.playerInfoTemplate.content.cloneNode(true);
        const infoPanel = templateClone.querySelector('.player-info');
        
        // 名前とリーダー表示を設定
        const nameEl = infoPanel.querySelector('.player-name');
        nameEl.textContent = `${playerInfo.name}`;        nameEl.className = `player-name ${teamConfig.textColor}`;

        // 各パーツの情報を設定し、DOM参照をキャッシュ
        Object.entries(parts).forEach(([key, part]) => {
            const partEl = infoPanel.querySelector(`[data-part-key="${key}"]`);
            if (!partEl || !part) return;
            const partNameEl = partEl.querySelector('.part-name');
            // PartKeyToInfoMapからアイコン情報を取得
            partNameEl.textContent = PartKeyToInfoMap[key]?.icon || '?'; 

            // DOM生成時にHPバーの初期状態（幅と色）を直接設定する
            // これにより、バトル開始直後にHPゲージが正しく表示されることを保証する
            const barEl = partEl.querySelector('.part-hp-bar');
            const hpPercentage = (part.hp / part.maxHp) * 100;
            barEl.style.width = `${hpPercentage}%`;

            if (hpPercentage > 50) barEl.style.backgroundColor = '#68d391';
            else if (hpPercentage > 20) barEl.style.backgroundColor = '#f6e05e';
            else barEl.style.backgroundColor = '#f56565';

            // HP数値の初期値を設定
            const valueEl = partEl.querySelector('.part-hp-value');
            if (valueEl) {
                valueEl.textContent = `${part.hp}/${part.maxHp}`;
            }
        });

        // 生成した情報パネルを対応するチームのコンテナに追加
        this.teamContainers[playerInfo.teamId].appendChild(infoPanel);

        // UIManagerにDOM要素を登録
        const domElements = {
            iconElement: icon,
            homeMarkerElement: marker,
            infoPanel: infoPanel,
            targetIndicatorElement: indicator,
            guardIndicatorElement: guardIndicator, // ガードインジケーターを登録
            partDOMElements: {}
        };

        // 各パーツのDOM要素を設定
        Object.entries(parts).forEach(([key, part]) => {
            const partEl = infoPanel.querySelector(`[data-part-key="${key}"]`);
            if (partEl) {
                domElements.partDOMElements[key] = {
                    container: partEl,
                    name: partEl.querySelector('.part-name'),
                    bar: partEl.querySelector('.part-hp-bar'),
                    value: partEl.querySelector('.part-hp-value') // HP数値要素への参照を追加
                };
            }
        });

        this.uiManager.registerEntity(entityId, domElements);
    }

    // このシステムはイベント駆動なのでupdateは不要
    update(deltaTime) {}
}