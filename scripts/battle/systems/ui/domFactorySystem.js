import { BaseSystem } from '../../../engine/baseSystem.js';
import { CONFIG } from '../../common/config.js';
import { GameEvents } from '../../common/events.js';
import * as Components from '../../components/index.js';
import { TeamID, PartKeyToInfoMap, PartInfo } from '../../common/constants.js';
import { UIManager } from '../../ui/UIManager.js';
import { el } from '../../../engine/utils/domUtils.js';

/**
 * DOM要素の生成、配置、削除に特化したシステム。
 * HTMLテンプレートを利用せず、elユーティリティを用いて宣言的にDOM構造を定義します。
 */
export class DomFactorySystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        
        // コンテナ要素への参照をキャッシュ
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

        const marker = el('div', {
            className: 'home-marker',
            style: { left: `${homeX * 100}%`, top: `${position.y}%` }
        });

        const targetIndicator = el('div', { className: 'target-indicator' }, [
            el('div', { className: 'corner corner-1' }),
            el('div', { className: 'corner corner-2' }),
            el('div', { className: 'corner corner-3' }),
            el('div', { className: 'corner corner-4' })
        ]);

        const guardIndicator = el('div', { className: 'guard-indicator' });

        const icon = el('div', {
            id: `player-${entityId}-icon`,
            className: 'player-icon',
            textContent: playerInfo.name.substring(playerInfo.name.length - 1),
            style: { backgroundColor: playerInfo.color }
        }, [
            targetIndicator,
            guardIndicator
        ]);

        this.battlefield.appendChild(marker);
        this.battlefield.appendChild(icon);

        // --- 2. プレイヤー情報パネルを生成 ---
        const partDOMElements = {};

        // 各パーツの行を作成するヘルパー
        const createPartRow = (key, part) => {
            if (!part) return null;

            const hpPercentage = (part.hp / part.maxHp) * 100;
            let barColor = '#f56565';
            if (hpPercentage > 50) barColor = '#68d391';
            else if (hpPercentage > 20) barColor = '#f6e05e';

            // 要素の参照を保持するための変数
            let nameEl, barEl, valueEl;

            const row = el('div', { className: 'part-hp', dataset: { partKey: key } }, [
                nameEl = el('span', { 
                    className: 'part-name', 
                    textContent: PartKeyToInfoMap[key]?.icon || '?' 
                }),
                el('div', { className: 'part-hp-bar-container' }, [
                    barEl = el('div', { 
                        className: 'part-hp-bar',
                        style: { width: `${hpPercentage}%`, backgroundColor: barColor }
                    })
                ]),
                valueEl = el('span', {
                    className: 'part-hp-value',
                    textContent: `${part.hp}/${part.maxHp}`
                })
            ]);

            // DOM要素への参照を保存
            partDOMElements[key] = {
                container: row,
                name: nameEl,
                bar: barEl,
                value: valueEl
            };

            return row;
        };

        const infoPanel = el('div', { className: 'player-info' }, [
            el('div', { 
                className: `player-name ${teamConfig.textColor}`, 
                textContent: playerInfo.name 
            }),
            createPartRow(PartInfo.HEAD.key, parts.head),
            createPartRow(PartInfo.RIGHT_ARM.key, parts.rightArm),
            createPartRow(PartInfo.LEFT_ARM.key, parts.leftArm),
            createPartRow(PartInfo.LEGS.key, parts.legs),
        ]);

        this.teamContainers[playerInfo.teamId].appendChild(infoPanel);

        // UIManagerにDOM要素を登録
        const domElements = {
            iconElement: icon,
            homeMarkerElement: marker,
            infoPanel: infoPanel,
            targetIndicatorElement: targetIndicator,
            guardIndicatorElement: guardIndicator,
            partDOMElements: partDOMElements
        };

        this.uiManager.registerEntity(entityId, domElements);
    }
}
