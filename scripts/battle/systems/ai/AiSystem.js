/**
 * @file AiSystem.js
 * @description AI思考システム。AiActionStateコンポーネントを監視して処理する。
 */
import { System } from '../../../../engine/core/System.js';
import { AiDecisionService } from '../../services/AiDecisionService.js';
import { AiActionState } from '../../components/States.js';

export class AiSystem extends System {
    constructor(world) {
        super(world);
        // Serviceはステートレスになったためインスタンス化不要
    }

    update(deltaTime) {
        const entities = this.getEntities(AiActionState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, AiActionState);
            if (state.isActive) {
                // 状態を非アクティブに
                state.isActive = false;

                // AI思考実行 (純粋関数として呼び出し)
                AiDecisionService.processAiTurn(this.world, entityId);
            }
        }
    }
}