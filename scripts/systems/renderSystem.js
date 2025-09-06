// scripts/systems/renderSystem.js:

import { PlayerInfo, Position, Gauge, GameState, Parts, DOMReference } from '../components.js';
import { PlayerStateType, TeamID } from '../constants.js'; // TeamIDをインポート
import { BaseSystem } from './baseSystem.js';

export class RenderSystem extends BaseSystem {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(PlayerInfo, Position, Gauge, GameState, Parts, DOMReference);

        for (const entityId of entities) {
            this.updatePosition(entityId);
            this.updateInfoPanel(entityId);
        }
    }

    /**
     * Positionコンポーネントのデータに基づき、プレイヤーアイコンのDOM要素のスタイルを更新します。
     * 位置計算のロジックはMovementSystemに分離されました。
     * @param {number} entityId 
     */
    updatePosition(entityId) {
        const domRef = this.getCachedComponent(entityId, DOMReference);
        if (!domRef || !domRef.iconElement) return;

        // 位置と状態のコンポーネントを取得
        const position = this.getCachedComponent(entityId, Position);
        const gameState = this.getCachedComponent(entityId, GameState);

        if (!position || !gameState) return;

        // Positionコンポーネントのx座標をDOMのleftスタイルに適用
        domRef.iconElement.style.left = `${position.x * 100}%`;
        domRef.iconElement.style.top = `${position.y}%`;
        domRef.iconElement.style.transform = 'translate(-50%, -50%)';

        // 状態に応じたCSSクラスの切り替え
        domRef.iconElement.classList.toggle('ready-execute', gameState.state === PlayerStateType.READY_EXECUTE);
        domRef.iconElement.classList.toggle('broken', gameState.state === PlayerStateType.BROKEN);
    }

    updateInfoPanel(entityId) {
        const domRef = this.getCachedComponent(entityId, DOMReference);
        const parts = this.getCachedComponent(entityId, Parts);

        if (!domRef || !parts) return;

        Object.entries(parts).forEach(([key, part]) => {
            const elements = domRef.partDOMElements[key];
            if (!elements) return;

            const hpPercentage = (part.hp / part.maxHp) * 100;
            elements.bar.style.width = `${hpPercentage}%`;
            elements.container.classList.toggle('broken', part.isBroken);

            if (part.isBroken) {
                elements.bar.style.backgroundColor = '#4a5568';
            } else {
                if (hpPercentage > 50) elements.bar.style.backgroundColor = '#68d391';
                else if (hpPercentage > 20) elements.bar.style.backgroundColor = '#f6e05e';
                else elements.bar.style.backgroundColor = '#f56565';
            }
        });
    }
}
