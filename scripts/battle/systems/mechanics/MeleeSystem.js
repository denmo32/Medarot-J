/**
 * @file MeleeSystem.js
 * @description 格闘アクションを処理するシステム。
 * パス修正: index.js経由でコンポーネントをインポート。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, SequenceState, CombatContext, CombatResult,
    IsMeleeAction, TargetResolved 
} from '../../components/index.js';
import { CombatService } from '../../services/CombatService.js';

export class MeleeSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(BattleSequenceState, IsMeleeAction, CombatContext, TargetResolved);
        
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            if (state.currentState !== SequenceState.CALCULATING) continue;

            this._processMelee(entityId);
        }
    }

    _processMelee(entityId) {
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

        state.currentState = SequenceState.GENERATING_VISUALS;
        state.contextData = resultData;
    }
}