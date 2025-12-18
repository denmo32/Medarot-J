/**
 * @file CombatService.js
 * @description 戦闘計算の共通ロジックを提供するサービス。
 * パーツEntity対応: QueryService経由でのデータ取得、Builder利用。
 */
import { Parts, PlayerInfo } from '../../components/index.js';
import { Action, CombatContext, ApplyEffect, EffectContext } from '../components/index.js';
import { CombatCalculator } from '../logic/CombatCalculator.js';
import { CombatParameterBuilder } from './CombatParameterBuilder.js';
import { QueryService } from './QueryService.js';
import { EffectType } from '../common/constants.js';

export class CombatService {
    
    /**
     * 戦闘コンテキストを初期化する
     * @param {World} world 
     * @param {number} attackerId 
     * @returns {CombatContext|null}
     */
    static initializeContext(world, attackerId) {
        const action = world.getComponent(attackerId, Action);
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const attackerParts = world.getComponent(attackerId, Parts); // Note: IDs inside
        
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        
        const attackingPartId = attackerParts[action.partKey];
        if (attackingPartId === null) return null;

        // ここでデータを展開してキャッシュしておく
        const attackingPartData = QueryService.getPartData(world, attackingPartId);
        if (!attackingPartData) return null;

        const ctx = new CombatContext();
        ctx.attackerId = attackerId;
        ctx.action = action;
        ctx.attackerInfo = attackerInfo;
        ctx.attackerParts = attackerParts; // IDs
        ctx.attackingPart = attackingPartData; // Snapshot Data for Calculation
        ctx.isSupport = attackingPartData.isSupport;
        ctx.intendedTargetId = action.targetId;
        ctx.intendedTargetPartKey = action.targetPartKey;

        return ctx;
    }

    /**
     * 命中判定を行う
     */
    static calculateHitOutcome(world, ctx) {
        const builder = new CombatParameterBuilder(world);
        
        // Builderでパラメータを生成
        const rawParams = builder.buildHitOutcomeParams(ctx);
        
        // 確率計算 (Calculatorにロジックを集約)
        const params = {
            ...rawParams,
            evasionChance: CombatCalculator.calculateEvasionChance({
                mobility: rawParams.targetMobility,
                attackerSuccess: rawParams.attackerSuccess
            }),
            criticalChance: CombatCalculator.calculateCriticalChance({
                success: rawParams.attackerSuccess,
                mobility: rawParams.targetMobility,
                bonusChance: rawParams.bonusChance
            }),
            defenseChance: CombatCalculator.calculateDefenseChance({
                armor: rawParams.targetArmor
            })
        };

        ctx.outcome = CombatCalculator.resolveHitOutcome(params);
    }

    /**
     * エフェクトエンティティを生成する
     * @param {World} world 
     * @param {object} ctx - CombatContext
     */
    static spawnEffectEntities(world, ctx) {
        const { action, attackingPart, attackerId, finalTargetId, outcome, guardianInfo } = ctx;

        // 命中しなかった場合はエフェクトを生成しない（支援行動は必中）
        if (!outcome.isHit && finalTargetId) {
            return;
        }

        // 1. ガード消費エフェクト
        if (guardianInfo) {
            const guardEffectEntity = world.createEntity();
            world.addComponent(guardEffectEntity, new ApplyEffect({
                type: EffectType.CONSUME_GUARD,
                value: 0
            }));
            world.addComponent(guardEffectEntity, new EffectContext({
                sourceId: attackerId,
                targetId: guardianInfo.id,
                partKey: guardianInfo.partKey,
                parentId: attackerId,
                outcome: outcome, 
                attackingPart: attackingPart
            }));
        }

        // 2. メインエフェクト
        for (const effectDef of attackingPart.effects || []) {
            const effectEntity = world.createEntity();
            
            world.addComponent(effectEntity, new ApplyEffect({
                type: effectDef.type,
                value: 0, 
                calculation: effectDef.calculation,
                params: effectDef.params,
                penetrates: attackingPart.penetrates || false
            }));

            let targetPartKey = action.targetPartKey;
            
            // ダメージ系かつターゲットがいる場合、命中判定結果の部位を採用
            if (effectDef.type === EffectType.DAMAGE && finalTargetId) {
                targetPartKey = outcome.finalTargetPartKey;
            }

            world.addComponent(effectEntity, new EffectContext({
                sourceId: attackerId,
                targetId: finalTargetId,
                partKey: targetPartKey,
                parentId: attackerId,
                outcome: outcome,
                attackingPart: attackingPart
            }));
        }
    }

    /**
     * 戦闘結果データを構築する
     * @param {object} ctx - CombatContext
     * @returns {object} CombatResultデータ
     */
    static buildResultData(ctx) {
        const summary = {
            isGuardBroken: ctx.appliedEffects.some(e => e.isGuardBroken),
            isGuardExpired: ctx.appliedEffects.some(e => e.isExpired && e.type === EffectType.CONSUME_GUARD),
        };

        ctx.stateUpdates.push({
            type: 'TransitionToCooldown',
            targetId: ctx.attackerId
        });

        return {
            attackerId: ctx.attackerId,
            intendedTargetId: ctx.intendedTargetId,
            targetId: ctx.finalTargetId,
            attackingPart: ctx.attackingPart,
            isSupport: ctx.isSupport,
            guardianInfo: ctx.guardianInfo,
            outcome: ctx.outcome || { isHit: false },
            appliedEffects: ctx.appliedEffects,
            summary,
            isCancelled: ctx.shouldCancel,
            interruptions: ctx.interruptions,
            eventsToEmit: ctx.eventsToEmit,
            stateUpdates: ctx.stateUpdates,
        };
    }

    static buildCancelledResultData(ctx) {
        return {
            attackerId: ctx.attackerId,
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
    }
}