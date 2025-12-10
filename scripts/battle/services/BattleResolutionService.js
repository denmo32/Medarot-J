/**
 * @file BattleResolutionService.js
 * @description 戦闘の計算・解決フローを制御するサービス。
 * Worldへの副作用（書き換え）を完全に排除し、結果データ(BattleResult)の生成に専念する。
 */
import { Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { EffectType, TargetTiming } from '../../common/constants.js'; // TargetTimingを追加
import { CombatCalculator } from '../logic/CombatCalculator.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js'; 
import { TargetingService } from './TargetingService.js';
import { QueryService } from './QueryService.js';
import { EffectService } from './EffectService.js';
import { HookPhase } from '../definitions/HookRegistry.js';
import { BattleContext } from '../components/BattleContext.js';
import { GameEvents } from '../../common/events.js';
import { MessageService } from './MessageService.js';
import { targetingStrategies } from '../ai/targetingStrategies.js'; // targetingStrategiesを追加

export class BattleResolutionService {
    constructor(world) {
        this.world = world;
        this.battleContext = world.getSingletonComponent(BattleContext);
        this.messageGenerator = new MessageService(world);
    }

    resolve(attackerId) {
        const eventsToEmit = [];
        const allStateUpdates = []; 
        let visualSequence = [];
        
        // 1. コンテキスト初期化
        const ctx = this._initializeContext(attackerId);
        if (!ctx) {
            return { 
                attackerId, 
                isCancelled: true, 
                cancelReason: 'INTERRUPTED', 
                eventsToEmit,
                stateUpdates: [],
                visualSequence: []
            };
        }
        
        // 2. 移動後ターゲット解決 (POST_MOVE)
        this._resolvePostMoveTarget(ctx);

        // 3. 最終ターゲット解決 (ガード判定など)
        this._resolveTarget(ctx);
        if (ctx.shouldCancel) {
            return { 
                attackerId, 
                isCancelled: true, 
                cancelReason: 'TARGET_LOST', 
                eventsToEmit,
                stateUpdates: [],
                visualSequence: []
            };
        }

        // ★フック: 攻撃開始直前
        this.battleContext.hookRegistry.execute(HookPhase.BEFORE_COMBAT_CALCULATION, ctx);
        if (ctx.shouldCancel) return this._buildResult(ctx, eventsToEmit, allStateUpdates, visualSequence);

        // 4. 命中・クリティカル等の判定
        this._calculateHitOutcome(ctx);

        // ★フック: 命中判定後
        this.battleContext.hookRegistry.execute(HookPhase.AFTER_HIT_CALCULATION, ctx);

        // 5. 効果値計算
        this._calculateEffects(ctx);

        // ★フック: 効果適用前
        this.battleContext.hookRegistry.execute(HookPhase.BEFORE_EFFECT_APPLICATION, ctx);

        // 6. 適用データ生成 (副作用なし)
        this._resolveApplications(ctx, eventsToEmit, allStateUpdates);
        
        // ★フック: 効果適用後
        this.battleContext.hookRegistry.execute(HookPhase.AFTER_EFFECT_APPLICATION, ctx);

        // 7. 演出指示データ生成
        visualSequence = this._createVisuals(ctx);

        // 8. 結果構築
        return this._buildResult(ctx, eventsToEmit, allStateUpdates, visualSequence);
    }

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

    _resolvePostMoveTarget(ctx) {
        const { attackingPart, action, attackerId } = ctx;
        if (attackingPart && attackingPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
            const strategy = targetingStrategies[attackingPart.postMoveTargeting];
            if (strategy) {
                const targetData = strategy({ world: this.world, attackerId });
                if (targetData) {
                    // Actionコンポーネントとコンテキストの両方を更新
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                    ctx.intendedTargetId = targetData.targetId;
                    ctx.intendedTargetPartKey = targetData.targetPartKey;
                }
            }
        }
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

    _resolveApplications(ctx, eventsToEmit, allStateUpdates) {
        // ガード消費
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

                if (result.events) eventsToEmit.push(...result.events);
                if (result.stateUpdates) allStateUpdates.push(...result.stateUpdates);

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

    _createVisuals(ctx) {
        let visuals = [];
        
        const { attackerId, intendedTargetId, finalTargetId, guardianInfo, appliedEffects } = ctx;

        const animationTargetId = intendedTargetId || finalTargetId;
        visuals.push({
            type: 'ANIMATE',
            animationType: animationTargetId ? 'attack' : 'support',
            attackerId,
            targetId: animationTargetId
        });
        
        visuals.push(...this.messageGenerator.createDeclarationSequence(ctx));
        
        if (appliedEffects && appliedEffects.length > 0) {
            const mainEffectType = appliedEffects[0].type;
            visuals.push(...EffectRegistry.createVisuals(mainEffectType, {
                world: this.world,
                effects: appliedEffects,
                guardianInfo,
                messageGenerator: this.messageGenerator
            }));
        } else if (!ctx.outcome.isHit && ctx.intendedTargetId) {
            visuals.push(...this.messageGenerator.createResultSequence(ctx));
        }
        
        visuals.push({ type: 'EVENT', eventName: GameEvents.REFRESH_UI });
        visuals.push({ type: 'EVENT', eventName: GameEvents.CHECK_ACTION_CANCELLATION });
        
        return visuals;
    }

    _buildResult(ctx, eventsToEmit, stateUpdates, visualSequence) {
        const summary = {
            isGuardBroken: ctx.appliedEffects.some(e => e.isGuardBroken),
            isGuardExpired: ctx.appliedEffects.some(e => e.isExpired && e.type === EffectType.CONSUME_GUARD),
        };

        eventsToEmit.push({
            type: GameEvents.COMBAT_SEQUENCE_RESOLVED,
            payload: {
                attackerId: ctx.attackerId,
                appliedEffects: ctx.appliedEffects,
                attackingPart: ctx.attackingPart
            }
        });

        // クールダウンへの移行コマンドを追加
        stateUpdates.push({
            type: 'TRANSITION_TO_COOLDOWN',
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
            eventsToEmit,
            stateUpdates,
            visualSequence
        };
    }
}