import { System } from '../../../../engine/core/System.js';
import { AiDecisionService } from '../../services/AiDecisionService.js';
import { AiActionRequest } from '../../components/Requests.js';

export class AiSystem extends System {
    constructor(world) {
        super(world);
        this.decisionService = new AiDecisionService(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(AiActionRequest);
        for (const entityId of entities) {
            // リクエストを削除
            this.world.removeComponent(entityId, AiActionRequest);
            
            // AI思考実行
            this.decisionService.processAiTurn(entityId);
        }
    }
}