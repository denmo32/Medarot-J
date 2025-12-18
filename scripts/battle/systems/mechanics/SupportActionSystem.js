/**
 * @file SupportActionSystem.js
 * @description 支援アクション処理。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, CombatContext,
    IsSupportAction, IsHealAction, IsDefendAction, IsInterruptAction, TargetResolved,
    InCombatCalculation, ProcessingEffects, GeneratingVisuals
} from '../../components/index.js';
import { CombatService } from '../../services/CombatService.js';

export class SupportActionSystem extends System {
    constructor(world) {
        super(world);
        this.targetTags = [IsSupportAction, IsHealAction, IsDefendAction, IsInterruptAction];
    }

    update(deltaTime) {
        for (const Tag of this.targetTags) {
            const entities = this.world.getEntitiesWith(BattleSequenceState, InCombatCalculation, Tag, CombatContext, TargetResolved);
            
            for (const entityId of entities) {
                this._processSupport(entityId);
            }
        }
    }

    _processSupport(entityId) {
        const ctx = this.world.getComponent(entityId, CombatContext);
        
        if (ctx.shouldCancel) {
             this._handleCancel(entityId, ctx);
             return;
        }

        CombatService.calculateHitOutcome(this.world, ctx);
        CombatService.spawnEffectEntities(this.world, ctx);

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