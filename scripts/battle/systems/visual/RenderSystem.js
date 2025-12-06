/**
 * @file RenderSystem.js
 * @description Visualコンポーネントの状態をDOMに反映するシステム。
 * プレイヤー描画とエフェクト描画をそれぞれ専用のレンダラーに委譲し、
 * RenderSystem自体の責務を「レンダリングプロセスの管理」に限定しました。
 */
import { System } from '../../../../engine/core/System.js';
import { Visual, Position } from '../../components/index.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { TeamID } from '../../../common/constants.js';
import { PlayerRenderer } from '../../renderers/PlayerRenderer.js';
import { EffectRenderer } from '../../renderers/EffectRenderer.js';

export class RenderSystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        
        this.battlefield = document.getElementById('battlefield');
        this.teamContainers = {
            [TeamID.TEAM1]: document.querySelector('#team1InfoPanel .team-players-container'),
            [TeamID.TEAM2]: document.querySelector('#team2InfoPanel .team-players-container')
        };
        
        // レンダラーの初期化
        this.playerRenderer = new PlayerRenderer(world, this.battlefield, this.teamContainers, this.uiManager);
        this.effectRenderer = new EffectRenderer(this.battlefield, this.uiManager);

        this.managedEntities = new Set();
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

            // 初期化
            if (!visual.isInitialized) {
                // 初期座標の同期
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

            // 座標同期（アニメーション中でない場合）
            if (!visual.isAnimating) {
                const position = this.world.getComponent(entityId, Position);
                if (position) {
                    visual.x = position.x;
                    visual.y = position.y;
                }
            }

            this._updateDOM(entityId, visual);
        }
        
        // クリーンアップ
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
        const parts = this.world.getComponent(entityId, Parts);
        if (parts) {
            Object.keys(parts).forEach(key => {
                const part = parts[key];
                if (part && typeof part.hp === 'number') {
                    if (!visual.partsInfo[key]) visual.partsInfo[key] = {};
                    visual.partsInfo[key].current = part.hp;
                    visual.partsInfo[key].max = part.maxHp;
                }
            });
        }
    }
}