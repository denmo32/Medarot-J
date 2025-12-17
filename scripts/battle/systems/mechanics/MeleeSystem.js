/**
 * @file MeleeSystem.js
 * @description 格闘アクションを処理するシステム。
 * エフェクトエンティティ生成を行う。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, CombatContext,
    IsMeleeAction, TargetResolved, InCombatCalculation, ProcessingEffects, GeneratingVisuals
} from '../../components/index.js';
import { CombatService } from '../../services/CombatService.js';

export class MeleeSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(BattleSequenceState, InCombatCalculation, IsMeleeAction, CombatContext, TargetResolved);
        
        for (const entityId of entities) {
            this._processMelee(entityId);
        }
    }

    _processMelee(entityId) {
        const ctx = this.world.getComponent(entityId, CombatContext);
        
        if (ctx.shouldCancel) {
             this._handleCancel(entityId, ctx);
             return;
        }

        // 命中判定
        CombatService.calculateHitOutcome(this.world, ctx);
        
        // エフェクトエンティティ生成
        CombatService.spawnEffectEntities(this.world, ctx);

        // フェーズ遷移 -> ProcessingEffects
        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new ProcessingEffects());
    }

    _handleCancel(entityId, ctx) {
        const state = this.world.getComponent(entityId, BattleSequenceState);
        const resultData = CombatService.buildCancelledResultData(ctx);
        state.contextData = resultData;

        this.world.removeComponent(entityId, CombatContext);
        this.world.removeComponent(entityId, TargetResolved);
        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new GeneratingVisuals());
    }
}