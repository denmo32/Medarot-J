/**
 * @file ActionResolutionSystem.js
 * @description 行動解決フェーズの管理を担当するシステム。
 * CombatResolution, EffectApplicator, HistorySystemの責務を統合し、
 * 戦闘結果の判定、効果適用、履歴更新を同期的に実行する。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { Action, ActiveEffects, BattleLog, GameState, Gauge, Parts, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, PlayerStateType, EffectType, ActionType, PartInfo, ModalType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { findGuardian, findRandomPenetrationTarget, getValidAllies } from '../utils/queryUtils.js';
import { effectStrategies } from '../effects/effectStrategies.js';
// 新しい効果適用ロジック(Applicator)をインポート
import { applyDamage } from '../effects/applicators/damageApplicator.js';
import { applyHeal } from '../effects/applicators/healApplicator.js';
import { applyTeamEffect, applySelfEffect } from '../effects/applicators/statusEffectApplicator.js';


export class ActionResolutionSystem extends BaseSystem {
    /**
     * @param {World} world 
     */
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // 効果の適用ロジックをまとめたマップを定義
        this.effectApplicators = {
            [EffectType.DAMAGE]: applyDamage,
            [EffectType.HEAL]: applyHeal,
            [EffectType.APPLY_SCAN]: applyTeamEffect,
            [EffectType.APPLY_GUARD]: applySelfEffect,
            // APPLY_GLITCH は StateSystem が直接状態を変化させるため、ここでは不要
        };

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
        
        this.updateHistory({ attackerId, appliedEffects, attackingPart });
        
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
                // 貫通ダメージの処理
                if (result.isPartBroken && result.penetrates && result.overkillDamage > 0) {
                    const nextTarget = findRandomPenetrationTarget(this.world, result.targetId, result.partKey);
                    if (nextTarget) {
                        // 次の貫通ダメージ効果をキューの先頭に追加
                        effectQueue.unshift({ 
                            ...effect, 
                            partKey: nextTarget, 
                            value: result.overkillDamage, 
                            isPenetration: true 
                        });
                    }
                }
            }
        }
        return appliedEffects;
    }
    
    // _applyDamage, _applyHeal, _applyTeamEffect, _applySingleEffect は外部Applicatorに移譲したため削除
    
    /**
     * 履歴更新ロジックを厳格化
     * @param {object} context
     * @param {number} context.attackerId
     * @param {Array<object>} context.appliedEffects
     * @param {object} context.attackingPart
     */
    updateHistory({ attackerId, appliedEffects, attackingPart }) {
        // 履歴更新の対象となる主要な効果を探す (ダメージまたは回復)
        const mainEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE || e.type === EffectType.HEAL);
        if (!mainEffect) return;

        const { targetId, partKey } = mainEffect;
        if (targetId === null || targetId === undefined) return;
        
        // --- 1. 個人履歴 (BattleLog) の更新 ---
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        if (attackerLog) {
            // FOCUS性格などのために、行動対象は常に記録する
            attackerLog.lastAttack = { targetId, partKey };
        }
        
        // ダメージを与えた場合のみ、被攻撃履歴を更新
        if (mainEffect.type === EffectType.DAMAGE) {
            const targetLog = this.world.getComponent(targetId, BattleLog);
            if (targetLog) {
                targetLog.lastAttackedBy = attackerId;
            }
        }

        // --- 2. チーム履歴 (BattleContext) の更新 ---
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);

        // 攻撃アクションの場合のみ teamLastAttack を更新する
        // これにより、回復行動がASSIST性格のターゲット選択に影響を与えるのを防ぐ
        if (!attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            this.battleContext.history.teamLastAttack[attackerInfo.teamId] = { targetId, partKey };
        }

        // 敵リーダーにダメージを与えた場合のみ leaderLastAttackedBy を更新する
        if (targetInfo.isLeader && !attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            this.battleContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }
    
    _getCombatComponents(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        return { action, attackerInfo, attackerParts };
    }
}