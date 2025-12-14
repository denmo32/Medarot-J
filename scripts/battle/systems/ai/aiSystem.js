/**
 * @file AiSystem.js
 * @description AI思考システム。AiActionRequestコンポーネントを監視して処理する。
 */
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
            // リクエストを削除 (二重処理防止)
            this.world.removeComponent(entityId, AiActionRequest);
            
            // AI思考実行 (ActionService経由で ActionSelectedRequest を生成する)
            this.decisionService.processAiTurn(entityId);
        }
    }
}