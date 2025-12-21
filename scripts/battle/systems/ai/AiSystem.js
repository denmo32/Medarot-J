/**
 * @file AiSystem.js
 * @description AI思考システム。AiActionStateコンポーネントを監視して処理する。
 * AiDecisionService -> AiLogic
 */
import { System } from '../../../../engine/core/System.js';
import { AiLogic } from '../../ai/AiLogic.js';
import { AiActionState } from '../../components/States.js';

export class AiSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(AiActionState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, AiActionState);
            if (state.isActive) {
                // 状態を非アクティブに
                state.isActive = false;

                // AI思考実行 (純粋関数として呼び出し)
                AiLogic.processAiTurn(this.world, entityId);
            }
        }
    }
}