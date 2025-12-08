/**
 * @file BattleResolver.js
 * @description 戦闘の計算ロジック。
 * EffectRegistryを利用して計算・適用フローを制御する。
 */
import { Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { CombatCalculator } from './CombatCalculator.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js'; 
import { TargetingService } from '../services/TargetingService.js';
import { QueryService } from '../services/QueryService.js';

export class BattleResolver {
    constructor(world) {
        this.world = world;
    }

    resolve(attackerId) {
        const ctx = this._initializeContext(attackerId);
        if (!ctx) {
            return { attackerId, isCancelled: true, cancelReason: 'INTERRUPTED' };
        }

        this._resolveTarget(ctx);
        if (ctx.shouldCancel) {
            return { attackerId, isCancelled: true, cancelReason: 'TARGET_LOST' };
        }

        this._calculateHitOutcome(ctx);

        this._calculateEffects(ctx);

        this._resolveApplications(ctx);

        return this._buildResult(ctx);
    }

    // --- Private Steps ---

    _initializeContext(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        
        const attackingPart = attackerParts[action.partKey];
        if (!attackingPart) return null;

        return {
            attackerId,
            action,
            attackerInfo,
            attackerParts,
            attackingPart,
            isSupport: attackingPart.isSupport,
            intendedTargetId: action.targetId,
            intendedTargetPartKey: action.targetPartKey,
            finalTargetId: null,
            finalTargetPartKey: null,
            guardianInfo: null,
            targetLegs: null,
            outcome: null,
            rawEffects: [],
            appliedEffects: [],
            shouldCancel: false
        };
    }

    _resolveTarget(ctx) {
        const resolution = TargetingService.resolveActualTarget(
            this.world, 
            ctx.attackerId, 
            ctx.intendedTargetId, 
            ctx.intendedTargetPartKey, 
            ctx.isSupport
        );
        
        if (resolution.shouldCancel) {
            ctx.shouldCancel = true;
            return;
        }

        ctx.finalTargetId = resolution.finalTargetId;
        ctx.finalTargetPartKey = resolution.finalTargetPartKey;
        ctx.guardianInfo = resolution.guardianInfo;

        if (ctx.finalTargetId !== null) {
            ctx.targetLegs = this.world.getComponent(ctx.finalTargetId, Parts)?.legs;
        }
    }

    _calculateHitOutcome(ctx) {
        const { attackingPart } = ctx;
        const mainEffect = attackingPart.effects?.find(e => e.type === EffectType.DAMAGE);
        const calcParams = mainEffect?.calculation || {};

        ctx.outcome = CombatCalculator.resolveHitOutcome({
            world: this.world,
            attackerId: ctx.attackerId,
            targetId: ctx.finalTargetId,
            attackingPart: ctx.attackingPart,
            targetLegs: ctx.targetLegs,
            initialTargetPartKey: ctx.finalTargetPartKey,
            calcParams: calcParams
        });
    }

    _calculateEffects(ctx) {
        const { action, attackingPart, attackerInfo, attackerParts, finalTargetId, outcome } = ctx;

        if (!outcome.isHit && finalTargetId) {
            return;
        }

        for (const effectDef of attackingPart.effects || []) {
            // EffectRegistryを利用して計算
            const result = EffectRegistry.process(effectDef.type, {
                world: this.world,
                sourceId: ctx.attackerId,
                targetId: finalTargetId,
                effect: effectDef,
                part: attackingPart,
                partKey: action.partKey,
                partOwner: { info: attackerInfo, parts: attackerParts },
                outcome,
            });

            if (result) {
                result.penetrates = attackingPart.penetrates || false;
                result.calculation = effectDef.calculation; 
                ctx.rawEffects.push(result);
            }
        }
    }

    _resolveApplications(ctx) {
        // 1. ガード消費の追加
        if (ctx.guardianInfo) {
            ctx.rawEffects.push({
                type: EffectType.CONSUME_GUARD,
                targetId: ctx.guardianInfo.id,
                partKey: ctx.guardianInfo.partKey
            });
        }

        // 2. 各効果の適用計算
        const effectQueue = [...ctx.rawEffects];

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            
            // EffectRegistryを利用して適用
            const result = EffectRegistry.apply(effect.type, { world: this.world, effect });

            if (result) {
                ctx.appliedEffects.push(result);

                // --- 貫通処理 ---
                if (result.isPartBroken && result.overkillDamage > 0 && result.penetrates) {
                    
                    const nextTargetPartKey = QueryService.findRandomPenetrationTarget(this.world, result.targetId, result.partKey);
                    
                    if (nextTargetPartKey) {
                        const nextEffect = {
                            type: EffectType.DAMAGE,
                            targetId: result.targetId,
                            partKey: nextTargetPartKey,
                            value: result.overkillDamage,
                            penetrates: true,
                            isPenetration: true,
                            calculation: result.calculation,
                            isCritical: result.isCritical
                        };
                        
                        effectQueue.unshift(nextEffect);
                    }
                }
            }
        }
    }

    _buildResult(ctx) {
        const summary = {
            isGuardBroken: ctx.appliedEffects.some(e => e.isGuardBroken),
            isGuardExpired: ctx.appliedEffects.some(e => e.isExpired && e.type === EffectType.CONSUME_GUARD),
        };

        return {
            attackerId: ctx.attackerId,
            intendedTargetId: ctx.intendedTargetId,
            targetId: ctx.finalTargetId,
            attackingPart: ctx.attackingPart,
            isSupport: ctx.isSupport,
            guardianInfo: ctx.guardianInfo,
            outcome: ctx.outcome,
            appliedEffects: ctx.appliedEffects,
            summary, 
            isCancelled: false
        };
    }
}