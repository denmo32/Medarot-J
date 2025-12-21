/**
 * @file ActionExecutionSystem.js
 * @description アクションの実行（計算とエフェクト生成）を行うシステム。
 * CombatParameterBuilder の import を関数版に変更。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, CombatContext, TargetResolved,
    InCombatCalculation, ProcessingEffects, GeneratingVisuals
} from '../../components/index.js';
import { ApplyEffect, EffectContext } from '../../components/effects/Effects.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { buildHitOutcomeParams } from '../../logic/CombatParameterBuilder.js';
import { EffectType } from '../../common/constants.js';

export class ActionExecutionSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(
            BattleSequenceState, 
            InCombatCalculation, 
            TargetResolved, 
            CombatContext
        );
        
        for (const entityId of entities) {
            this._executeAction(entityId);
        }
    }

    _executeAction(entityId) {
        const ctx = this.world.getComponent(entityId, CombatContext);
        
        if (ctx.shouldCancel) {
             this._handleCancel(entityId, ctx);
             return;
        }

        // 1. 命中判定・結果計算 (Calculator + Builder)
        const params = buildHitOutcomeParams(this.world, ctx);
        
        // 確率計算（Calculatorへ委譲）
        const calcParams = {
            ...params,
            evasionChance: CombatCalculator.calculateEvasionChance({
                mobility: params.targetMobility,
                attackerSuccess: params.attackerSuccess
            }),
            criticalChance: CombatCalculator.calculateCriticalChance({
                success: params.attackerSuccess,
                mobility: params.targetMobility,
                bonusChance: params.bonusChance
            }),
            defenseChance: CombatCalculator.calculateDefenseChance({
                armor: params.targetArmor
            })
        };

        ctx.outcome = CombatCalculator.resolveHitOutcome(calcParams);

        // 2. エフェクトエンティティの生成 (旧spawnEffectEntities)
        this._spawnEffects(entityId, ctx);

        // 3. パイプライン遷移
        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new ProcessingEffects());
    }

    _spawnEffects(entityId, ctx) {
        const { action, attackingPart, attackerId, finalTargetId, outcome, guardianInfo } = ctx;

        // 命中しなかった場合はエフェクトを生成しない（支援行動は必中扱い）
        if (!outcome.isHit && finalTargetId) {
            return;
        }

        // 1. ガード消費エフェクト
        if (guardianInfo) {
            const guardEffectEntity = this.world.createEntity();
            this.world.addComponent(guardEffectEntity, new ApplyEffect({
                type: EffectType.CONSUME_GUARD,
                value: 0
            }));
            this.world.addComponent(guardEffectEntity, new EffectContext({
                sourceId: attackerId,
                targetId: guardianInfo.id,
                partKey: guardianInfo.partKey,
                parentId: attackerId,
                outcome: outcome, 
                attackingPart: attackingPart
            }));
        }

        // 2. メインエフェクト群
        const effects = attackingPart.effects || [];
        for (const effectDef of effects) {
            const effectEntity = this.world.createEntity();
            
            this.world.addComponent(effectEntity, new ApplyEffect({
                type: effectDef.type,
                value: 0, 
                calculation: effectDef.calculation,
                params: effectDef.params,
                penetrates: attackingPart.penetrates || false
            }));

            let targetPartKey = action.targetPartKey;
            
            // ダメージ系かつターゲットがいる場合、命中判定結果（身代わり含む）の部位を採用
            if (effectDef.type === EffectType.DAMAGE && finalTargetId) {
                targetPartKey = outcome.finalTargetPartKey;
            }

            this.world.addComponent(effectEntity, new EffectContext({
                sourceId: attackerId,
                targetId: finalTargetId,
                partKey: targetPartKey,
                parentId: attackerId,
                outcome: outcome,
                attackingPart: attackingPart
            }));
        }
    }

    _handleCancel(entityId, ctx) {
        const state = this.world.getComponent(entityId, BattleSequenceState);
        
        // キャンセル用の簡易結果データを構築
        const resultData = {
            attackerId: ctx.attackerId,
            attackingPartId: ctx.attackingPartId,
            intendedTargetId: ctx.intendedTargetId,
            targetId: null,
            attackingPart: ctx.attackingPart,
            isSupport: ctx.isSupport,
            outcome: { isHit: false },
            appliedEffects: [],
            isCancelled: true,
            interruptions: [],
            eventsToEmit: [],
            stateUpdates: ctx.stateUpdates || [],
        };
        state.contextData = resultData;

        this.world.removeComponent(entityId, CombatContext);
        this.world.removeComponent(entityId, TargetResolved);
        this.world.removeComponent(entityId, InCombatCalculation);
        
        this.world.addComponent(entityId, new GeneratingVisuals());
    }
}