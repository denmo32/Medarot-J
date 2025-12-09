/**
 * @file BattleResolutionService.js
 * @description 戦闘の計算・解決フローを制御するサービス。
 * HookRegistryを利用して、拡張性と処理順序の安全性を確保する。
 */
import { Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { CombatCalculator } from '../logic/CombatCalculator.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js'; 
import { TargetingService } from './TargetingService.js';
import { QueryService } from './QueryService.js';
import { EffectService } from './EffectService.js';
import { HookPhase } from '../definitions/HookRegistry.js';
import { BattleContext } from '../components/BattleContext.js';

export class BattleResolutionService {
    constructor(world) {
        this.world = world;
        this.battleContext = world.getSingletonComponent(BattleContext);
    }

    resolve(attackerId) {
        // 1. コンテキスト初期化
        const ctx = this._initializeContext(attackerId);
        if (!ctx) {
            return { attackerId, isCancelled: true, cancelReason: 'INTERRUPTED' };
        }

        // 2. ターゲット解決
        this._resolveTarget(ctx);
        if (ctx.shouldCancel) {
            return { attackerId, isCancelled: true, cancelReason: 'TARGET_LOST' };
        }

        // ★フック: 攻撃開始直前 (トラップ、カウンターなど)
        this.battleContext.hookRegistry.execute(HookPhase.BEFORE_COMBAT_CALCULATION, ctx);
        if (ctx.shouldCancel) return this._buildResult(ctx);

        // 3. 命中・クリティカル等の判定
        this._calculateHitOutcome(ctx);

        // ★フック: 命中判定後 (絶対回避、ヒット時スキルなど)
        this.battleContext.hookRegistry.execute(HookPhase.AFTER_HIT_CALCULATION, ctx);

        // 4. 効果値（ダメージ量など）の計算
        this._calculateEffects(ctx);

        // ★フック: 効果適用前 (ダメージ軽減、属性バリアなど)
        this.battleContext.hookRegistry.execute(HookPhase.BEFORE_EFFECT_APPLICATION, ctx);

        // 5. 最終的な適用処理 (HP減算、ステート変更など)
        this._resolveApplications(ctx);
        
        // ★フック: 効果適用後 (反撃、追撃など)
        this.battleContext.hookRegistry.execute(HookPhase.AFTER_EFFECT_APPLICATION, ctx);

        // 6. 結果構築
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
            world: this.world,
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
            shouldCancel: false,
            interruptions: [], 
            customData: {} 
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
        const { attackingPart, attackerId, attackerParts, finalTargetId, targetLegs } = ctx;
        
        if (!finalTargetId || !targetLegs) {
            ctx.outcome = CombatCalculator.resolveHitOutcome({
                isSupport: ctx.isSupport,
                evasionChance: 0,
                criticalChance: 0,
                defenseChance: 0,
                initialTargetPartKey: ctx.finalTargetPartKey,
                bestDefensePartKey: null
            });
            return;
        }

        const calcParams = attackingPart.effects?.find(e => e.type === EffectType.DAMAGE)?.calculation || {};
        const baseStatKey = calcParams.baseStat || 'success';
        const defenseStatKey = calcParams.defenseStat || 'armor';

        const attackerSuccess = EffectService.getStatModifier(this.world, attackerId, baseStatKey, { 
            attackingPart: attackingPart, 
            attackerLegs: attackerParts.legs 
        }) + (attackingPart[baseStatKey] || 0);

        const targetMobility = (targetLegs.mobility || 0);

        const evasionChance = CombatCalculator.calculateEvasionChance({
            mobility: targetMobility,
            attackerSuccess: attackerSuccess
        });

        const bonusChance = EffectService.getCriticalChanceModifier(attackingPart);
        const criticalChance = CombatCalculator.calculateCriticalChance({
            success: attackerSuccess,
            mobility: targetMobility,
            bonusChance: bonusChance
        });

        const targetArmor = (targetLegs[defenseStatKey] || 0);
        const defenseChance = CombatCalculator.calculateDefenseChance({
            armor: targetArmor
        });
        
        const bestDefensePartKey = QueryService.findBestDefensePart(this.world, finalTargetId);

        ctx.outcome = CombatCalculator.resolveHitOutcome({
            isSupport: ctx.isSupport,
            evasionChance,
            criticalChance,
            defenseChance,
            initialTargetPartKey: ctx.finalTargetPartKey,
            bestDefensePartKey
        });
    }

    _calculateEffects(ctx) {
        const { action, attackingPart, attackerInfo, attackerParts, finalTargetId, outcome } = ctx;

        if (!outcome.isHit && finalTargetId) {
            return;
        }

        for (const effectDef of attackingPart.effects || []) {
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
        if (ctx.guardianInfo) {
            ctx.rawEffects.push({
                type: EffectType.CONSUME_GUARD,
                targetId: ctx.guardianInfo.id,
                partKey: ctx.guardianInfo.partKey
            });
        }

        const effectQueue = [...ctx.rawEffects];

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            
            const result = EffectRegistry.apply(effect.type, { world: this.world, effect });

            if (result) {
                ctx.appliedEffects.push(result);

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
            outcome: ctx.outcome || { isHit: false },
            appliedEffects: ctx.appliedEffects,
            summary, 
            isCancelled: ctx.shouldCancel, 
            interruptions: ctx.interruptions 
        };
    }
}