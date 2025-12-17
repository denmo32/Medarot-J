/**
 * @file TargetingSystem.js
 * @description ターゲット解決を行うシステム。
 * InCombatCalculation タグを持つエンティティのみを処理する。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, Action, CombatContext,
    RequiresPostMoveTargeting, RequiresPreMoveTargeting, TargetResolved,
    InCombatCalculation, GeneratingVisuals
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
        // 計算フェーズかつ、移動前ターゲット解決が必要なエンティティ
        const preEntities = this.world.getEntitiesWith(BattleSequenceState, InCombatCalculation, RequiresPreMoveTargeting);
        for (const entityId of preEntities) {
            this._resolveTarget(entityId);
        }

        // --- Post-Move Targeting Resolution ---
        // 計算フェーズかつ、移動後ターゲット解決が必要なエンティティ
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
        // 既に解決済みならスキップ
        if (this.world.getComponent(entityId, TargetResolved)) return;

        let ctx = this.world.getComponent(entityId, CombatContext);
        if (!ctx) {
            ctx = CombatService.initializeContext(this.world, entityId);
            if (!ctx) {
                // コンテキスト生成失敗 -> 計算中断
                const state = this.world.getComponent(entityId, BattleSequenceState);
                state.contextData = { isCancelled: true, cancelReason: 'INTERRUPTED' };
                
                this.world.removeComponent(entityId, InCombatCalculation);
                this.world.addComponent(entityId, new GeneratingVisuals());
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