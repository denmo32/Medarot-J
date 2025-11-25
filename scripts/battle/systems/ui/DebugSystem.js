import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';

export class DebugSystem extends System {
    constructor(world) {
        super(world);
        this.world.on(GameEvents.STRATEGY_EXECUTED, this.onStrategyExecuted.bind(this));
    }

    onStrategyExecuted(detail) {
        const { strategy, attackerId, target } = detail;
        console.log(
            `%c[AI DEBUG] Attacker ${attackerId} used strategy %c'${strategy}'%c -> Target: Entity ${target.targetId}, Part ${target.targetPartKey}`,
            'color: #90cdf4;',
            'color: #faf089; font-weight: bold;',
            'color: #90cdf4;'
        );
    }
}