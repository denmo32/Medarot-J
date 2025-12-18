/**
 * @file ShootSystem.js
 * @description 射撃アクション処理。
 * CombatContextの初期化はCombatServiceに委譲済みなので、ここではフェーズ遷移のみ。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, CombatContext,
    IsShootingAction, TargetResolved, InCombatCalculation, ProcessingEffects, GeneratingVisuals
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