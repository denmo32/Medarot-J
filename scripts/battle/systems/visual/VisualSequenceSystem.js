/**
 * @file VisualSequenceSystem.js
 * @description 演出シーケンス生成システム。
 * VisualSequenceFactoryにロジックを委譲し、システムの責務を軽減。
 */
import { System } from '../../../../engine/core/System.js';
import {
    BattleSequenceState, GeneratingVisuals, ExecutingVisuals,
    VisualSequence, CombatResult, SequenceFinished
} from '../../components/index.js';
import { VisualSequenceFactory } from '../../visuals/VisualSequenceFactory.js';
import { VisualStrategyRegistry } from '../../visuals/VisualStrategyRegistry.js';

export class VisualSequenceSystem extends System {
    constructor(world) {
        super(world);
        // StrategyRegistryの初期化（DefaultVisualStrategyにworldを渡すため）
        VisualStrategyRegistry.initialize(world);
        
        // Factoryの初期化
        this.factory = new VisualSequenceFactory(world);
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(BattleSequenceState, GeneratingVisuals);

        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            const combatResult = this.world.getComponent(entityId, CombatResult);
            const context = state.contextData || (combatResult ? combatResult.data : null);

            // シーケンスデータの生成
            const sequenceDefs = this.factory.createSequence(entityId, context);

            if (!sequenceDefs) {
                this._abortSequence(entityId);
                continue;
            }

            // コンポーネントの付与
            this.world.addComponent(entityId, new VisualSequence(sequenceDefs));

            if (combatResult) this.world.removeComponent(entityId, CombatResult);
            this.world.removeComponent(entityId, GeneratingVisuals);
            this.world.addComponent(entityId, new ExecutingVisuals());
        }
    }

    _abortSequence(entityId) {
        this.world.removeComponent(entityId, GeneratingVisuals);
        this.world.addComponent(entityId, new SequenceFinished());
    }
}