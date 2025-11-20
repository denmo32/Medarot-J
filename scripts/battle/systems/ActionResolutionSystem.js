/**
 * @file ActionResolutionSystem.js
 * @description 行動解決フェーズの管理を担当するシステム。
 * CombatResolution, EffectApplicator の責務を統合し、
 * 戦闘結果の判定、効果適用を同期的に実行する。
 * 履歴更新の責務は BattleHistorySystem に移譲された。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { Action, ActiveEffects, Parts, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, EffectType, ActionCancelReason } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { findGuardian, isValidTarget } from '../utils/queryUtils.js';
import { effectStrategies } from '../effects/effectStrategies.js';
import { effectApplicators } from '../effects/applicators/applicatorIndex.js';

export class ActionResolutionSystem extends BaseSystem {
    /**
     * @param {World} world 
     */
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // 効果適用ロジックのマップを外部からインポート
        this.effectApplicators = effectApplicators;

        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    /**
     * このシステムはイベント駆動に変更されたため、updateループは不要
     * @param {number} deltaTime 
     */
    update(deltaTime) {
    }
    
    /**
     * アニメーション完了をトリガーに、アクション解決処理を開始する
     * @param {object} detail 
     */
    onExecutionAnimationCompleted(detail) {
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            return;
        }
        this.resolveAction(detail.entityId);
    }

    resolveAction(attackerId) {
        const components = this._getCombatComponents(attackerId);
        if (!components) {
            this.world.emit(GameEvents.ACTION_COMPLETED, { entityId: attackerId });
            return;
        }
        const { action, attackerInfo, attackerParts } = components;
        const attackingPart = attackerParts[action.partKey];
        
        // フェイルセーフ: ターゲットを必要とするアクションで、かつターゲットが無効になっている場合は、アクションを解決せずに終了する
        const isTargetRequired = attackingPart.targetScope && (attackingPart.targetScope.endsWith('_SINGLE') || attackingPart.targetScope.endsWith('_TEAM'));
        // 支援行動（isSupport: true）の場合、ターゲットがいなくてもターゲットロストとして扱わない
        if (isTargetRequired && !attackingPart.isSupport && !isValidTarget(this.world, action.targetId, action.targetPartKey)) {
            console.warn(`ActionResolutionSystem: Target for entity ${attackerId} is no longer valid at resolution time. Cancelling action.`);
            // アクションをキャンセル済みとしてクールダウンへ移行させる
            this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: attackerId, reason: ActionCancelReason.TARGET_LOST });
            return;
        }
        
        let finalTargetId = action.targetId;
        let finalTargetPartKey = action.targetPartKey;
        let targetLegs = this.world.getComponent(finalTargetId, Parts)?.legs;
        
        let guardianInfo = null;
        if (!attackingPart.isSupport && finalTargetId !== null) {
            guardianInfo = findGuardian(this.world, finalTargetId);
            if (guardianInfo) {
                finalTargetId = guardianInfo.id;
                finalTargetPartKey = guardianInfo.partKey;
                targetLegs = this.world.getComponent(finalTargetId, Parts)?.legs;
            }
        }

        const outcome = CombatCalculator.resolveHitOutcome({
            world: this.world,
            attackerId,
            targetId: finalTargetId,
            attackingPart,
            targetLegs,
            initialTargetPartKey: finalTargetPartKey
        });
        finalTargetPartKey = outcome.finalTargetPartKey;

        const resolvedEffects = [];
        if (outcome.isHit || !finalTargetId) {
            for (const effectDef of attackingPart.effects || []) {
                const strategy = effectStrategies[effectDef.type];
                if (strategy) {
                    const result = strategy({
                        world: this.world,
                        sourceId: attackerId,
                        targetId: finalTargetId,
                        effect: effectDef,
                        part: attackingPart,
                        partKey: action.partKey,
                        partOwner: { info: attackerInfo, parts: attackerParts },
                        outcome: { ...outcome, finalTargetPartKey },
                    });
                    if (result) {
                        result.penetrates = attackingPart.penetrates || false;
                        resolvedEffects.push(result);
                    }
                }
            }
        }
        
        const appliedEffects = this.applyAllEffects({ attackerId, resolvedEffects, guardianInfo });
        
        // 履歴更新ロジックは BattleHistorySystem に移譲されたため、ここでは呼び出さない
        // this.updateHistory({ attackerId, appliedEffects, attackingPart });
        
        this.world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, {
            attackerId,
            targetId: finalTargetId,
            attackingPart,
            isSupport: attackingPart.isSupport,
            guardianInfo,
            outcome,
            appliedEffects
        });
    }

    /**
     * 全ての効果を適用するプロセス。ロジックを外部のApplicatorに移譲し、自身はフロー制御に専念する。
     * @param {object} context - { attackerId, resolvedEffects, guardianInfo }
     * @returns {Array<object>} 実際に適用された効果の結果リスト
     */
    applyAllEffects({ attackerId, resolvedEffects, guardianInfo }) {
        const appliedEffects = [];
        const effectQueue = [...resolvedEffects];

        // ガードが発動した場合、ガード回数を消費させる
        if (guardianInfo) {
            const guardEffectComp = this.world.getComponent(guardianInfo.id, ActiveEffects);
            const guardEffect = guardEffectComp?.effects.find(e => e.type === EffectType.APPLY_GUARD);
            if (guardEffect) {
                guardEffect.count--;
                if (guardEffect.count <= 0) {
                    this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId: guardianInfo.id, effect: guardEffect });
                }
            }
        }

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            // Applicatorマップから対応する適用関数を取得
            const applicator = this.effectApplicators[effect.type];
            let result = null;

            if (applicator) {
                // Applicatorに関数を委譲
                result = applicator({ world: this.world, effect });
            } else {
                // Applicatorが定義されていない効果は、そのまま結果として扱う
                result = effect;
            }

            if (result) {
                appliedEffects.push(result);
                // 貫通ダメージの処理を、Applicatorから返された nextEffect に基づく汎用的なロジックに変更
                if (result.nextEffect) {
                    // 次の効果をキューの先頭に追加して連鎖させる
                    effectQueue.unshift(result.nextEffect);
                }
            }
        }
        return appliedEffects;
    }
    
    _getCombatComponents(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        return { action, attackerInfo, attackerParts };
    }
}