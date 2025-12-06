import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { AiDecisionService } from '../../services/AiDecisionService.js';

export class AiSystem extends System {
    constructor(world) {
        super(world);
        this.decisionService = new AiDecisionService(world);
        this.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    onAiActionRequired(detail) {
        const { entityId } = detail;
        this.decisionService.processAiTurn(entityId);
    }
}