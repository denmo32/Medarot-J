/**
 * @file BattleResolutionService.js
 * @description 戦闘の計算・解決フローを制御するサービス。
 * Worldへの副作用（書き換え）を完全に排除し、結果データ(BattleResult)の生成に専念する。
 */
import { Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { EffectType, TargetTiming } from '../common/constants.js';
import { CombatCalculator } from '../logic/CombatCalculator.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js'; 
import { TargetingService } from './TargetingService.js';
import { QueryService } from './QueryService.js';
import { EffectService } from './EffectService.js';
import { HookPhase } from '../definitions/HookRegistry.js';
import { HookContext } from '../components/HookContext.js';
import { GameEvents } from '../../common/events.js';
import { MessageService } from './MessageService.js';
import { VisualSequenceGenerator } from '../logic/VisualSequenceGenerator.js';
import { targetingStrategies } from '../ai/targetingStrategies.js';

export class BattleResolutionService {
    constructor(world) {
        this.world = world;
        this.hookContext = world.getSingletonComponent(HookContext);
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

        // 2. 最終ターゲット解決 (ガード判定など)
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

        // フック: 攻撃開始直前
        this.hookContext.hookRegistry.execute(HookPhase.BEFORE_COMBAT_CALCULATION, ctx);
        if (ctx.shouldCancel) return this._buildResult(ctx, eventsToEmit, allStateUpdates, visualSequence);

        // 3. 命中・クリティカル等の判定
        this._calculateHitOutcome(ctx);

        // フック: 命中判定後
        this.hookContext.hookRegistry.execute(HookPhase.AFTER_HIT_CALCULATION, ctx);

        // 4. 効果値計算
        this._calculateEffects(ctx);

        // フック: 効果適用前
        this.hookContext.hookRegistry.execute(HookPhase.BEFORE_EFFECT_APPLICATION, ctx);

        // 5. 適用データ生成 (副作用なし)
        const { appliedEffects, eventsToEmit: newEvents, stateUpdates: newStateUpdates } = EffectRegistry.applyAll(ctx.rawEffects, ctx);
        ctx.appliedEffects = appliedEffects;
        eventsToEmit.push(...newEvents);
        allStateUpdates.push(...newStateUpdates);

        // フック: 効果適用後
        this.hookContext.hookRegistry.execute(HookPhase.AFTER_EFFECT_APPLICATION, ctx);

        // 6. 演出指示データ生成
        visualSequence = this._createVisuals(ctx);

        // 7. 結果構築
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
        ctx.outcome = CombatCalculator.calculateHitOutcomeFromContext(ctx);
    }

    _calculateEffects(ctx) {
        EffectRegistry.processAll(ctx);
    }

    _createVisuals(ctx) {
        // VisualSequenceGeneratorに演出シーケンスの生成を委譲
        return VisualSequenceGenerator.generateVisualSequence(ctx);
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