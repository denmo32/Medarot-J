/**
 * @file TargetingSystem.js
 * @description ターゲット解決を行うシステム。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, Action, CombatContext,
    RequiresPostMoveTargeting, RequiresPreMoveTargeting, TargetResolved,
    InCombatCalculation, GeneratingVisuals
} from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { TargetingService } from '../../services/TargetingService.js';
import { targetingStrategies } from '../../ai/unit/strategies/index.js';
import { CombatService } from '../../services/CombatService.js';
import { EffectScope } from '../../common/constants.js';
import { QueryService } from '../../services/QueryService.js';

export class TargetingSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // --- Pre-Move Targeting Resolution ---
        const preEntities = this.world.getEntitiesWith(BattleSequenceState, InCombatCalculation, RequiresPreMoveTargeting);
        for (const entityId of preEntities) {
            this._resolveTarget(entityId);
        }

        // --- Post-Move Targeting Resolution ---
        const postEntities = this.world.getEntitiesWith(BattleSequenceState, InCombatCalculation, RequiresPostMoveTargeting);
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
        
        const partId = parts[action.partKey];
        const part = QueryService.getPartData(this.world, partId);
        if (!part) return;

        // PostMove戦略があれば実行
        if (part.postMoveTargeting) {
            const strategy = targetingStrategies[part.postMoveTargeting];
            if (strategy) {
                const rawResult = strategy({ world: this.world, attackerId: entityId });
                // サービスの正規化ロジックを使用
                const normalized = TargetingService.normalizeStrategyResult(rawResult);
                
                if (normalized) {
                    action.targetId = normalized.targetId;
                    action.targetPartKey = normalized.targetPartKey;
                }
            }
        }
    }

    _resolveTarget(entityId) {
        if (this.world.getComponent(entityId, TargetResolved)) return;

        let ctx = this.world.getComponent(entityId, CombatContext);
        if (!ctx) {
            ctx = CombatService.initializeContext(this.world, entityId);
            if (!ctx) {
                const state = this.world.getComponent(entityId, BattleSequenceState);
                state.contextData = { isCancelled: true, cancelReason: 'INTERRUPTED' };
                
                this.world.removeComponent(entityId, InCombatCalculation);
                this.world.addComponent(entityId, new GeneratingVisuals());
                return;
            }
            this.world.addComponent(entityId, ctx);
        }

        // 自分自身へのターゲット（SELF）の場合の自動解決
        if (ctx.intendedTargetId === null) {
            const part = ctx.attackingPart;
            if (part && part.targetScope === EffectScope.SELF) {
                ctx.intendedTargetId = entityId;
            }
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
                ctx.targetLegs = QueryService.getPartData(this.world, targetParts?.legs);
            }
        }
        
        this.world.addComponent(entityId, new TargetResolved());
    }
}