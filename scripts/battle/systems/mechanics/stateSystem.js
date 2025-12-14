import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { HandleGaugeFullRequest } from '../../components/CommandRequests.js';

export class StateSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        const reqEntity = this.world.createEntity();
        this.world.addComponent(reqEntity, new HandleGaugeFullRequest(entityId));
    }
}