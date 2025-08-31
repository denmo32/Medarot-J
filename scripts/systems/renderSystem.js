// scripts/systems/renderSystem.js:

import { PlayerInfo, Position, Gauge, GameState, Parts, DOMReference } from '../components.js';
import { PlayerStateType, TeamID } from '../constants.js'; // TeamIDをインポート

export class RenderSystem {
    constructor(world) {
        this.world = world;
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
        const domRef = this.world.getComponent(entityId, DOMReference);
        if (!domRef.iconElement) return;

        // 位置と状態のコンポーネントを取得
        const position = this.world.getComponent(entityId, Position);
        const gameState = this.world.getComponent(entityId, GameState);

        // Positionコンポーネントのx座標をDOMのleftスタイルに適用
        domRef.iconElement.style.left = `${position.x * 100}%`;
        domRef.iconElement.style.top = `${position.y}%`;
        domRef.iconElement.style.transform = 'translate(-50%, -50%)';

        // 状態に応じたCSSクラスの切り替え
        const isReadyForSelection = gameState.state === PlayerStateType.READY_SELECT || gameState.state === PlayerStateType.COOLDOWN_COMPLETE;
        domRef.iconElement.classList.toggle('ready-select', isReadyForSelection);
        domRef.iconElement.classList.toggle('ready-execute', gameState.state === PlayerStateType.READY_EXECUTE);
        domRef.iconElement.classList.toggle('broken', gameState.state === PlayerStateType.BROKEN);
    }

    updateInfoPanel(entityId) {
        const domRef = this.world.getComponent(entityId, DOMReference);
        const parts = this.world.getComponent(entityId, Parts);

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
