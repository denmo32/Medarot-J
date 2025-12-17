/**
 * @file TargetingSystem.js
 * @description ターゲット解決を行うシステム。
 * パス修正: index.js経由でコンポーネントをインポート。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, SequenceState, Action, CombatContext,
    RequiresPostMoveTargeting, RequiresPreMoveTargeting, TargetResolved
} from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { TargetingService } from '../../services/TargetingService.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';
import { CombatService } from '../../services/CombatService.js';

export class TargetingSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // --- Pre-Move Targeting Resolution ---
        const preEntities = this.world.getEntitiesWith(BattleSequenceState, RequiresPreMoveTargeting);
        for (const entityId of preEntities) {
            this._resolveTarget(entityId);
        }

        // --- Post-Move Targeting Resolution ---
        const postEntities = this.world.getEntitiesWith(BattleSequenceState, RequiresPostMoveTargeting);
        for (const entityId of postEntities) {
            this._resolvePostMoveSelection(entityId);
            this._resolveTarget(entityId);
        }
    }

    _resolvePostMoveSelection(entityId) {
        const action = this.world.getComponent(entityId, Action);
        if (action.targetId !== null) return;

        const parts = this.world.getComponent(entityId, Parts);
        if (!parts || !action.partKey) return;
        const part = parts[action.partKey];
        if (!part) return;

        const strategy = targetingStrategies[part.postMoveTargeting];
        if (strategy) {
            const targetData = strategy({ world: this.world, attackerId: entityId });
            if (targetData) {
                action.targetId = targetData.targetId;
                action.targetPartKey = targetData.targetPartKey;
            }
        }
    }

    _resolveTarget(entityId) {
        const state = this.world.getComponent(entityId, BattleSequenceState);
        if (state.currentState !== SequenceState.CALCULATING) return;
        
        if (this.world.getComponent(entityId, TargetResolved)) return;

        let ctx = this.world.getComponent(entityId, CombatContext);
        if (!ctx) {
            ctx = CombatService.initializeContext(this.world, entityId);
            if (!ctx) {
                state.contextData = { isCancelled: true, cancelReason: 'INTERRUPTED' };
                state.currentState = SequenceState.GENERATING_VISUALS;
                return;
            }
            this.world.addComponent(entityId, ctx);
        }

        const resolution = TargetingService.resolveActualTarget(
            this.world,
            ctx.attackerId,
            ctx.intendedTargetId,
            ctx.intendedTargetPartKey,
            ctx.isSupport
        );

        if (resolution.shouldCancel) {
            ctx.shouldCancel = true;
            ctx.cancelReason = 'TARGET_LOST';
        } else {
            ctx.finalTargetId = resolution.finalTargetId;
            ctx.finalTargetPartKey = resolution.finalTargetPartKey;
            ctx.guardianInfo = resolution.guardianInfo;
            
            if (ctx.finalTargetId !== null) {
                const targetParts = this.world.getComponent(ctx.finalTargetId, Parts);
                ctx.targetLegs = targetParts?.legs;
            }
        }
        
        this.world.addComponent(entityId, new TargetResolved());
    }
}