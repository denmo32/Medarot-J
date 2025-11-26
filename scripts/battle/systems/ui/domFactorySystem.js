import { System } from '../../../../engine/core/System.js';
import { CONFIG } from '../../../config/gameConfig.js';
import { GameEvents } from '../../../common/events.js';
import * as Components from '../../components/index.js';
import { TeamID, PartKeyToInfoMap, PartInfo } from '../../../config/constants.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { el } from '../../../../engine/utils/DOMUtils.js';

export class DomFactorySystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        
        this.battlefield = document.getElementById('battlefield');
        this.teamContainers = {
            [TeamID.TEAM1]: document.querySelector('#team1InfoPanel .team-players-container'),
            [TeamID.TEAM2]: document.querySelector('#team2InfoPanel .team-players-container')
        };
        
        this.on(GameEvents.SETUP_UI_REQUESTED, this.onSetupUIRequested.bind(this));
        this.on(GameEvents.GAME_WILL_RESET, this.onGameWillReset.bind(this));
    }

    /**
     * システム破棄時にDOMをクリーンアップします。
     */
    destroy() {
        this.clearDOM();
        super.destroy();
    }

    /**
     * DOM要素を初期状態に戻します。
     */
    clearDOM() {
        if (this.battlefield) {
            // アクションラインを維持してクリア
            this.battlefield.innerHTML = '<div class="action-line-1"></div><div class="action-line-2"></div>';
        }
        
        Object.values(this.teamContainers).forEach(container => {
            if (container) {
                container.innerHTML = '';
            }
        });

        if (this.uiManager) {
            this.uiManager.clear();
        }
    }

    onSetupUIRequested() {
        const playerEntities = this.getEntities(Components.PlayerInfo);
        for (const entityId of playerEntities) {
            this._createPlayerDOM(entityId);
        }
    }

    onGameWillReset() {
        this.clearDOM();
    }

    _createPlayerDOM(entityId) {
        const playerInfo = this.world.getComponent(entityId, Components.PlayerInfo);
        const parts = this.world.getComponent(entityId, Components.Parts);
        const position = this.world.getComponent(entityId, Components.Position);
        const teamConfig = CONFIG.TEAMS[playerInfo.teamId];
        
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

        const partDOMElements = {};

        const createPartRow = (key, part) => {
            if (!part) return null;

            const hpPercentage = (part.hp / part.maxHp) * 100;
            let barColor = '#f56565';
            if (hpPercentage > 50) barColor = '#68d391';
            else if (hpPercentage > 20) barColor = '#f6e05e';

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