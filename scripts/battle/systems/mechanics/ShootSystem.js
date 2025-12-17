/**
 * @file ShootSystem.js
 * @description 射撃アクションを処理するシステム。
 * InCombatCalculationタグを使用。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, CombatContext, CombatResult,
    IsShootingAction, TargetResolved, InCombatCalculation, GeneratingVisuals
} from '../../components/index.js';
import { CombatService } from '../../services/CombatService.js';

export class ShootSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(BattleSequenceState, InCombatCalculation, IsShootingAction, CombatContext, TargetResolved);
        
        for (const entityId of entities) {
            this._processShooting(entityId);
        }
    }

    _processShooting(entityId) {
        const ctx = this.world.getComponent(entityId, CombatContext);
        const state = this.world.getComponent(entityId, BattleSequenceState);

        if (ctx.shouldCancel) {
             this._finalize(entityId, ctx, state);
             return;
        }

        CombatService.calculateHitOutcome(this.world, ctx);
        CombatService.calculateEffects(this.world, ctx);
        CombatService.applyEffects(this.world, ctx);

        this._finalize(entityId, ctx, state);
    }

    _finalize(entityId, ctx, state) {
        const resultData = CombatService.buildResultData(ctx);
        
        this.world.addComponent(entityId, new CombatResult(resultData));
        
        this.world.removeComponent(entityId, CombatContext);
        this.world.removeComponent(entityId, TargetResolved);

        // 次のフェーズへ遷移
        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new GeneratingVisuals());
        
        state.contextData = resultData;
    }
}