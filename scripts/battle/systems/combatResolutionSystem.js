/**
 * @file 戦闘解決システム
 * このファイルは、戦闘における物理的な結果（命中、回避、ガード、最終ターゲット）を判定する責務を持ちます。
 * ActionSystemの肥大化を防ぎ、責務を明確に分離するために新設されました。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Action, PlayerInfo, Parts } from '../core/components/index.js';
import { ActionType } from '../common/constants.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { findGuardian } from '../utils/queryUtils.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * 戦闘結果の判定に特化したシステム。
 * 実行アニメーション完了後、ActionSystemからバトンを受け取り、
 * 命中判定、ガード判定、最終的なターゲットの決定を行います。
 */
export class CombatResolutionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // アニメーション完了イベントを購読し、戦闘結果の判定を開始します。
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    /**
     * 実行アニメーションが完了した際に呼び出され、戦闘結果を判定します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onExecutionAnimationCompleted(detail) {
        try {
            const { entityId: attackerId } = detail;

            // 手順1: 攻撃に必要なコンポーネント群をまとめて取得します。
            const components = this._getCombatComponents(attackerId);
            if (!components) {
                console.warn(`CombatResolutionSystem: Missing required components for combat resolution for attacker: ${attackerId}. Aborting sequence.`);
                // 攻撃シーケンスを正常に終了させるためのイベントを発行
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: attackerId });
                return;
            }
            const { action, attackerInfo, attackerParts, targetParts } = components;
            
            const attackingPart = attackerParts[action.partKey];
            const originalTargetId = action.targetId;
            let finalTargetId = originalTargetId;
            let finalTargetPartKey = action.targetPartKey;
            let targetLegs = targetParts ? targetParts.legs : null;
            let currentTargetParts = targetParts;

            // 手順2: ガード役を索敵し、必要であればターゲットを更新します。
            let guardianInfo = null;
            const isSingleDamageAction = !attackingPart.isSupport && [ActionType.SHOOT, ActionType.MELEE].includes(attackingPart.actionType) && finalTargetId !== null;

            if (isSingleDamageAction) {
                guardianInfo = findGuardian(this.world, finalTargetId);
                if (guardianInfo) {
                    // ターゲットをガード役に上書き
                    finalTargetId = guardianInfo.id;
                    finalTargetPartKey = guardianInfo.partKey;
                    // 上書き後のターゲット情報を再取得
                    currentTargetParts = this.getCachedComponent(finalTargetId, Parts);
                    targetLegs = currentTargetParts ? currentTargetParts.legs : null;
                }
            }

            // 手順3: 攻撃の命中結果（回避、クリティカル、防御）を決定します。
            const outcome = CombatCalculator.resolveHitOutcome({
                world: this.world,
                attackerId: attackerId,
                targetId: finalTargetId,
                attackingPart: attackingPart,
                targetLegs: targetLegs,
                initialTargetPartKey: finalTargetPartKey // ガード後のターゲットパーツキーを渡す
            });
            // 防御によって最終的なターゲットパーツが変更された場合、それを反映
            finalTargetPartKey = outcome.finalTargetPartKey;

            // 手順4: 判定結果を新しいイベントで発行し、後続のシステム（ActionSystem）に処理を委譲します。
            this.world.emit(GameEvents.COMBAT_OUTCOME_RESOLVED, {
                attackerId,
                originalTargetId,
                finalTargetId,
                finalTargetPartKey,
                attackingPart,
                attackerInfo,
                attackerParts,
                outcome,
                guardianInfo,
            });

        } catch (error) {
            ErrorHandler.handle(error, { method: 'onExecutionAnimationCompleted', detail });
        }
    }

    /**
     * @private
     * 攻撃の実行に必要なコンポーネント群をまとめて取得します。(ActionSystemから移管)
     * @param {number} attackerId - 攻撃者のエンティティID
     * @returns {object|null} 必要なコンポーネントをまとめたオブジェクト、または取得に失敗した場合null
     */
    _getCombatComponents(attackerId) {
        const action = this.getCachedComponent(attackerId, Action);
        if (!action) return null;

        const attackerInfo = this.getCachedComponent(attackerId, PlayerInfo);
        const attackerParts = this.getCachedComponent(attackerId, Parts);
        if (!attackerInfo || !attackerParts) {
            return null;
        }

        // ターゲットが存在する場合のみ、ターゲットのコンポーネントを取得
        if (this.isValidEntity(action.targetId)) {
            const targetParts = this.getCachedComponent(action.targetId, Parts);
            return { action, attackerInfo, attackerParts, targetParts };
        }

        // ターゲットがいない場合（援護など）
        return { action, attackerInfo, attackerParts, targetParts: null };
    }
    
    update(deltaTime) {
        // このシステムはイベント駆動のため、update処理は不要です。
    }
}