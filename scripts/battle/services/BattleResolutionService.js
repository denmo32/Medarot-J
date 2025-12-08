/**
 * @file BattleResolutionService.js
 * @description 戦闘の計算・解決フローを制御するサービス。
 * Worldから情報を収集し、Logic(CombatCalculator)に計算させ、結果をまとめる。
 * (旧 BattleResolver.js)
 */
import { Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { CombatCalculator } from '../logic/CombatCalculator.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js'; 
import { TargetingService } from './TargetingService.js';
import { QueryService } from './QueryService.js';
import { EffectService } from './EffectService.js';

export class BattleResolutionService {
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
        const { attackingPart, attackerId, attackerParts, finalTargetId, targetLegs } = ctx;
        
        // ターゲットがいない場合は計算スキップ（結果はデフォルトでfalse）
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

        // 計算に必要なパラメータの準備 (Service層の責務)
        const calcParams = attackingPart.effects?.find(e => e.type === EffectType.DAMAGE)?.calculation || {};
        const baseStatKey = calcParams.baseStat || 'success';
        const defenseStatKey = calcParams.defenseStat || 'armor';

        // 1. 回避率の計算パラメータ
        const attackerSuccess = EffectService.getStatModifier(this.world, attackerId, baseStatKey, { 
            attackingPart: attackingPart, 
            attackerLegs: attackerParts.legs 
        }) + (attackingPart[baseStatKey] || 0);

        const targetMobility = (targetLegs.mobility || 0); // 必要ならEffectService経由で補正取得

        const evasionChance = CombatCalculator.calculateEvasionChance({
            mobility: targetMobility,
            attackerSuccess: attackerSuccess
        });

        // 2. クリティカル率の計算パラメータ
        const bonusChance = EffectService.getCriticalChanceModifier(attackingPart);
        const criticalChance = CombatCalculator.calculateCriticalChance({
            success: attackerSuccess,
            mobility: targetMobility,
            bonusChance: bonusChance
        });

        // 3. 防御率の計算パラメータ
        const targetArmor = (targetLegs[defenseStatKey] || 0); // 必要ならEffectService経由で補正取得
        const defenseChance = CombatCalculator.calculateDefenseChance({
            armor: targetArmor
        });
        
        // 防御時の身代わりパーツ検索
        const bestDefensePartKey = QueryService.findBestDefensePart(this.world, finalTargetId);

        // Logic呼び出し
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