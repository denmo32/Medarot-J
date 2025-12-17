/**
 * @file SupportActionSystem.js
 * @description 支援・回復・妨害・防御などの非攻撃アクションを処理するシステム。
 * InCombatCalculationタグを使用。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, CombatContext, CombatResult,
    IsSupportAction, IsHealAction, IsDefendAction, IsInterruptAction, TargetResolved,
    InCombatCalculation, GeneratingVisuals
} from '../../components/index.js';
import { CombatService } from '../../services/CombatService.js';

export class SupportActionSystem extends System {
    constructor(world) {
        super(world);
        // 処理対象となるタグのリスト
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
        const state = this.world.getComponent(entityId, BattleSequenceState);

        if (ctx.shouldCancel) {
             this._finalize(entityId, ctx, state);
             return;
        }

        // 支援行動は必中扱い
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

        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new GeneratingVisuals());

        state.contextData = resultData;
    }
}