/**
 * @file TargetingSystem.js
 * @description ターゲット解決を行うシステム。
 * 移動後ターゲット選択において、パーツIDから正しくデータを取得するように修正。
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
        
        // パーツID取得
        const partId = parts[action.partKey];
        // QueryServiceを使ってデータを取得
        const part = QueryService.getPartData(this.world, partId);
        if (!part) return;

        // PostMove戦略があれば実行
        if (part.postMoveTargeting) {
            const strategy = targetingStrategies[part.postMoveTargeting];
            if (strategy) {
                const targetData = strategy({ world: this.world, attackerId: entityId });
                // targetData は { targetId, targetPartKey } または [{ target: ..., weight: ... }] 形式
                // strategies/postMoveTargeting.js の実装を見ると、
                // NEAREST_ENEMY は QueryService.selectRandomPart ({ targetId, targetPartKey }) を返す
                // MOST_DAMAGED_ALLY は { targetId, targetPartKey } を返す
                // supportTargeting.js の HEALER は [{ target, weight }] を返す可能性がある
                // 統一が必要だが、現状の実装依存で処理する。
                // aiDecisionUtils.js などのラッパーを通していないため、戦略関数の戻り値を直接扱う。
                
                // postMoveStrategies の実装確認:
                // NEAREST_ENEMY -> object {targetId, targetPartKey}
                // MOST_DAMAGED_ALLY -> object {targetId, targetPartKey}
                // しかし supportStrategies は array を返す実装になっている箇所がある (HEALER)
                
                if (Array.isArray(targetData) && targetData.length > 0) {
                    const topCandidate = targetData[0]; // 簡易的に先頭を使用
                    if (topCandidate.target) {
                        action.targetId = topCandidate.target.targetId;
                        action.targetPartKey = topCandidate.target.targetPartKey;
                    }
                } else if (targetData && targetData.targetId) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
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
                // targetPartKeyはnullでも良い（Effect側で適切に処理、またはActionDefinitionsで指定されている場合もある）
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
                ctx.targetLegs = QueryService.getPartData(this.world, targetParts?.legs); // データとして取得
            }
        }
        
        this.world.addComponent(entityId, new TargetResolved());
    }
}