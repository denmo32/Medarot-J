/**
 * @file CombatSystem.js
 * @description 戦闘計算フェーズを担当するシステム。
 * BattleSequenceState が CALCULATING のエンティティを処理し、CombatResult を生成して GENERATING_VISUALS へ遷移させる。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleSequenceState, SequenceState, CombatResult, Action } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectRegistry } from '../../definitions/EffectRegistry.js';
import { TargetingService } from '../../services/TargetingService.js';
import { HookPhase } from '../../definitions/HookRegistry.js';
import { HookContext } from '../../components/HookContext.js';

export class CombatSystem extends System {
    constructor(world) {
        super(world);
        this.hookContext = world.getSingletonComponent(HookContext);
    }

    update(deltaTime) {
        // CALCULATING 状態のエンティティを検索
        const entities = this.world.getEntitiesWith(BattleSequenceState);
        
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            if (state.currentState !== SequenceState.CALCULATING) continue;

            // 計算実行
            const resultData = this._resolveCombat(entityId);
            
            // 結果をコンポーネントとして付与 (BattleHistorySystem等が参照)
            // 次のフェーズの入力データとしても機能する
            this.world.addComponent(entityId, new CombatResult(resultData));
            
            // パイプライン状態を更新
            state.currentState = SequenceState.GENERATING_VISUALS;
            // 結果をコンテキストにも保存（VisualSequenceSystemで参照しやすくするため）
            state.contextData = resultData;
        }
    }

    _resolveCombat(attackerId) {
        const eventsToEmit = [];
        const allStateUpdates = []; 
        
        // 1. コンテキスト初期化
        const ctx = this._initializeContext(attackerId);
        if (!ctx) {
            return {
                attackerId,
                isCancelled: true,
                cancelReason: 'INTERRUPTED',
                eventsToEmit,
                stateUpdates: [],
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
            };
        }

        // フック: 攻撃開始直前
        this.hookContext.hookRegistry.execute(HookPhase.BEFORE_COMBAT_CALCULATION, ctx);
        if (ctx.shouldCancel) return this._buildResult(ctx, eventsToEmit, allStateUpdates);

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

        // 6. 結果構築
        return this._buildResult(ctx, eventsToEmit, allStateUpdates);
    }

    // --- Private Methods (ロジックは変更なし、参照のみ) ---

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

    _buildResult(ctx, eventsToEmit, stateUpdates) {
        const summary = {
            isGuardBroken: ctx.appliedEffects.some(e => e.isGuardBroken),
            isGuardExpired: ctx.appliedEffects.some(e => e.isExpired && e.type === EffectType.CONSUME_GUARD),
        };

        // クールダウンへの移行リクエストを追加 (アクション完了後の状態遷移)
        stateUpdates.push({
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
            eventsToEmit,
            stateUpdates,
        };
    }
}