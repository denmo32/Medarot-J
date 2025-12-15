import { System } from '../../../../engine/core/System.js';
import { StrategyExecutedEvent } from '../../components/Requests.js';

export class DebugSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(StrategyExecutedEvent);
        for (const entityId of entities) {
            const evt = this.world.getComponent(entityId, StrategyExecutedEvent);
            const { strategy, attackerId, target } = evt;
            
            console.log(
                `%c[AI DEBUG] Attacker ${attackerId} used strategy %c'${strategy}'%c -> Target: Entity ${target.targetId}, Part ${target.targetPartKey}`,
                'color: #90cdf4;',
                'color: #faf089; font-weight: bold;',
                'color: #90cdf4;'
            );

            // デバッグイベントの消費（削除）
            this.world.destroyEntity(entityId);
        }
    }
}