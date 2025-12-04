/**
 * @file BattleResolver.js
 * @description 戦闘の計算ロジック。
 * パイプラインパターンを用いて、ターゲット解決から効果適用までの流れを順次処理する。
 */
import { Action, ActiveEffects } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { effectStrategies } from '../effects/effectStrategies.js';
import { effectApplicators } from '../effects/applicators/applicatorIndex.js';
import { TargetingService } from '../services/TargetingService.js';

export class BattleResolver {
    constructor(world) {
        this.world = world;
        this.effectApplicators = effectApplicators;
    }

    /**
     * アクションの結果を解決する
     * @param {number} attackerId 
     * @returns {object} 結果データ
     */
    resolve(attackerId) {
        // 1. 戦闘コンテキストの初期化 (必要なコンポーネントの収集)
        const ctx = this._initializeContext(attackerId);
        if (!ctx) {
            return { attackerId, isCancelled: true, cancelReason: 'INTERRUPTED' };
        }

        // 2. ターゲット解決フェーズ (かばう判定、ターゲット生存確認)
        this._resolveTarget(ctx);
        if (ctx.shouldCancel) {
            return { attackerId, isCancelled: true, cancelReason: 'TARGET_LOST' };
        }

        // 3. 命中・クリティカル判定フェーズ
        this._calculateHitOutcome(ctx);

        // 4. 効果計算フェーズ (ダメージ算出など。まだ適用はしない)
        this._calculateEffects(ctx);

        // 5. 副作用解決フェーズ (ガード消費、実際のHP変動量計算、イベント生成)
        this._resolveApplications(ctx);

        // 6. 結果の整形と返却
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

        // パイプライン全体で共有するデータコンテナ
        return {
            // 入力データ
            attackerId,
            action,
            attackerInfo,
            attackerParts,
            attackingPart,
            isSupport: attackingPart.isSupport,

            // ターゲット解決結果
            intendedTargetId: action.targetId,
            intendedTargetPartKey: action.targetPartKey,
            finalTargetId: null,
            finalTargetPartKey: null,
            guardianInfo: null,
            targetLegs: null,
            
            // 計算結果
            outcome: null,      // isHit, isCritical, isDefended など
            rawEffects: [],     // 計算された効果のリスト (適用前)
            appliedEffects: [], // 適用後の効果リスト (実際のダメージ値、イベントなど)
            
            // 制御フラグ
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

        // メイン効果（ダメージ系）の計算パラメータを取得
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

        // 命中していない、かつターゲットが必要な攻撃なら効果計算をスキップ
        // (支援行動などは targetId が null でも効果がある場合があるため、isHitだけで判定しない方が安全だが、
        //  現状 CombatCalculator.resolveHitOutcome は支援行動なら isHit=true を返すのでOK)
        if (!outcome.isHit && finalTargetId) {
            return;
        }

        for (const effectDef of attackingPart.effects || []) {
            const strategy = effectStrategies[effectDef.type];
            if (!strategy) continue;

            const result = strategy({
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

        // 2. 各効果の適用計算（HP変動量確定、イベント生成）
        // rawEffects は貫通処理などで増える可能性があるためキューとして扱う
        const effectQueue = [...ctx.rawEffects];

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            
            const applicator = this.effectApplicators[effect.type];
            if (!applicator) continue;

            // applicatorは副作用なしで結果オブジェクトを返す設計になっている前提
            const result = applicator({ world: this.world, effect });

            if (result) {
                ctx.appliedEffects.push(result);
                // 貫通などで新たな効果が発生した場合はキューの先頭に追加
                if (result.nextEffect) {
                    effectQueue.unshift(result.nextEffect);
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