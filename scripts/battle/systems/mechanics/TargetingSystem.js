/**
 * @file TargetingSystem.js
 * @description ターゲット解決を行うシステム。
 * QueryService -> BattleQueries
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, Action, CombatContext,
    RequiresPostMoveTargeting, RequiresPreMoveTargeting, TargetResolved,
    InCombatCalculation, GeneratingVisuals
} from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { targetingStrategies } from '../../ai/unit/strategies/index.js';
import { EffectScope } from '../../common/constants.js';
import { BattleQueries } from '../../queries/BattleQueries.js';
import { TargetingLogic } from '../../logic/TargetingLogic.js';
import { HookPhase } from '../../definitions/HookRegistry.js';
import { TraitRegistry } from '../../definitions/traits/TraitRegistry.js';

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
        const part = BattleQueries.getPartData(this.world, partId);
        if (!part) return;

        // PostMove戦略があれば実行
        if (part.postMoveTargeting) {
            const strategy = targetingStrategies[part.postMoveTargeting];
            if (strategy) {
                const rawResult = strategy({ world: this.world, attackerId: entityId });
                // Logicで正規化
                const normalized = TargetingLogic.normalizeStrategyResult(rawResult);
                
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
            ctx = this._initializeCombatContext(entityId);
            if (!ctx) {
                this._abortWithError(entityId, 'INTERRUPT_BY_ERROR');
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

        this._applyTargetResolution(entityId, ctx);
        
        this.world.addComponent(entityId, new TargetResolved());
    }

    /**
     * CombatContextの初期化
     */
    _initializeCombatContext(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        
        const attackingPartId = attackerParts[action.partKey];
        if (attackingPartId === null) return null;

        const attackingPartData = BattleQueries.getPartData(this.world, attackingPartId);
        if (!attackingPartData) return null;

        const ctx = new CombatContext();
        ctx.attackerId = attackerId;
        ctx.action = action;
        ctx.attackerInfo = attackerInfo;
        ctx.attackerParts = attackerParts;
        ctx.attackingPartId = attackingPartId;
        ctx.attackingPart = attackingPartData;
        ctx.isSupport = attackingPartData.isSupport;
        ctx.intendedTargetId = action.targetId;
        ctx.intendedTargetPartKey = action.targetPartKey;

        return ctx;
    }

    /**
     * 実際のターゲット解決
     */
    _applyTargetResolution(attackerId, ctx) {
        const { intendedTargetId, intendedTargetPartKey, isSupport } = ctx;

        if (isSupport) {
            ctx.finalTargetId = intendedTargetId;
            ctx.finalTargetPartKey = intendedTargetPartKey;
            return;
        }

        if (!BattleQueries.isValidTarget(this.world, intendedTargetId, intendedTargetPartKey)) {
            ctx.shouldCancel = true;
            ctx.cancelReason = 'TARGET_LOST';
            return;
        }

        // 初期設定
        const result = {
            finalTargetId: intendedTargetId,
            finalTargetPartKey: intendedTargetPartKey,
            guardianInfo: null
        };

        // ガード判定等のフック実行
        // システムが主導してTraitロジックを呼び出す
        TraitRegistry.executeTraitLogic('GUARD', HookPhase.ON_TARGET_RESOLVING, {
            world: this.world,
            originalTargetId: intendedTargetId,
            attackerId,
            result
        });

        // 結果反映
        ctx.finalTargetId = result.finalTargetId;
        ctx.finalTargetPartKey = result.finalTargetPartKey;
        ctx.guardianInfo = result.guardianInfo;

        if (ctx.finalTargetId !== null) {
            const targetParts = this.world.getComponent(ctx.finalTargetId, Parts);
            ctx.targetLegs = BattleQueries.getPartData(this.world, targetParts?.legs);
        }
    }

    _abortWithError(entityId, reason) {
        const state = this.world.getComponent(entityId, BattleSequenceState);
        if (state) {
            state.contextData = { isCancelled: true, cancelReason: reason };
        }
        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new GeneratingVisuals());
    }
}