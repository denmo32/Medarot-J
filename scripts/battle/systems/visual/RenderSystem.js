/**
 * @file RenderSystem.js
 * @description 初期化時のパーツデータ同期ロジックをQueryService経由に修正。
 * レイアウト定数をCSS変数としてDOMに注入する機能を追加。
 */
import { System } from '../../../../engine/core/System.js';
import { Visual, Position } from '../../components/index.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { TeamID } from '../../../common/constants.js';
import { PlayerRenderer } from './renderers/PlayerRenderer.js';
import { EffectRenderer } from './renderers/EffectRenderer.js';
import { BattleQueries } from '../../queries/BattleQueries.js';
import { CONFIG } from '../../common/config.js';

export class RenderSystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        
        this.battlefield = document.getElementById('battlefield');
        this.teamContainers = {
            [TeamID.TEAM1]: document.querySelector('#team1InfoPanel .team-players-container'),
            [TeamID.TEAM2]: document.querySelector('#team2InfoPanel .team-players-container')
        };
        
        this.playerRenderer = new PlayerRenderer(world, this.battlefield, this.teamContainers, this.uiManager);
        this.effectRenderer = new EffectRenderer(this.battlefield, this.uiManager);

        this.managedEntities = new Set();

        // 初期化時にCSS変数を設定
        this._setupCSSVariables();
    }

    /**
     * CONFIGの数値をCSS変数として注入し、JSとCSSのレイアウトを同期させる
     * @private
     */
    _setupCSSVariables() {
        if (!this.battlefield) return;

        const bf = CONFIG.BATTLEFIELD;
        const styles = {
            '--action-line-1': bf.ACTION_LINE_TEAM1,
            '--action-line-2': bf.ACTION_LINE_TEAM2,
            '--home-margin-1': bf.HOME_MARGIN_TEAM1,
            '--home-margin-2': bf.HOME_MARGIN_TEAM2,
        };

        for (const [key, value] of Object.entries(styles)) {
            this.battlefield.style.setProperty(key, value);
        }
    }

    destroy() {
        for (const entityId of this.managedEntities) {
            this._removeDOM(entityId);
        }
        this.managedEntities.clear();
        super.destroy();
    }

    update(deltaTime) {
        const currentEntities = new Set();
        const entities = this.getEntities(Visual);

        for (const entityId of entities) {
            currentEntities.add(entityId);
            const visual = this.world.getComponent(entityId, Visual);

            if (!visual.isInitialized) {
                const position = this.world.getComponent(entityId, Position);
                if (position) {
                    visual.x = position.x;
                    visual.y = position.y;
                }
                
                this._createDOM(entityId, visual);
                this._syncInitialValues(entityId, visual);
                visual.isInitialized = true;
                this.managedEntities.add(entityId);
            }

            if (!visual.isAnimating) {
                const position = this.world.getComponent(entityId, Position);
                if (position) {
                    visual.x = position.x;
                    visual.y = position.y;
                }
            }

            this._updateDOM(entityId, visual);
        }
        
        for (const entityId of this.managedEntities) {
            if (!currentEntities.has(entityId)) {
                this._removeDOM(entityId);
                this.managedEntities.delete(entityId);
            }
        }
    }

    _createDOM(entityId, visual) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        if (playerInfo) {
            this.playerRenderer.create(entityId, visual);
        } else {
            this.effectRenderer.create(entityId, visual);
        }
    }

    _updateDOM(entityId, visual) {
        const domElements = this.uiManager.getDOMElements(entityId);
        if (!domElements) return;

        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        if (playerInfo) {
            this.playerRenderer.update(entityId, visual, domElements);
        } else {
            this.effectRenderer.update(entityId, visual, domElements);
        }
    }

    _removeDOM(entityId) {
        const domElements = this.uiManager.getDOMElements(entityId);
        if (!domElements) return;

        if (domElements.iconElement) domElements.iconElement.remove();
        if (domElements.homeMarkerElement) domElements.homeMarkerElement.remove();
        if (domElements.infoPanel) domElements.infoPanel.remove();
        if (domElements.mainElement) domElements.mainElement.remove();

        this.uiManager.unregisterEntity(entityId);
    }

    _syncInitialValues(entityId, visual) {
        const partsList = BattleQueries.getParts(this.world, entityId, true, true);
        partsList.forEach(([key, partData]) => {
            if (!visual.partsInfo[key]) visual.partsInfo[key] = {};
            visual.partsInfo[key].current = partData.hp;
            visual.partsInfo[key].max = partData.maxHp;
        });
    }
}