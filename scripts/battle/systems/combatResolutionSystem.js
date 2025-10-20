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
        // [修正] GameEventsオブジェクトからイベントキーを参照するように修正
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    /**
     * 実行アニメーションが完了した際に呼び出され、戦闘結果を判定します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onExecutionAnimationCompleted(detail) {
        try {
            if (!detail || detail.entityId === undefined) {
                return;
            }

            const { entityId: attackerId } = detail;

            const components = this._getCombatComponents(attackerId);
            if (!components) {
                console.warn(`CombatResolutionSystem: Missing required components for combat resolution for attacker: ${attackerId}. Aborting sequence.`);
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

            let guardianInfo = null;
            const isSingleDamageAction = !attackingPart.isSupport && [ActionType.SHOOT, ActionType.MELEE].includes(attackingPart.actionType) && finalTargetId !== null;

            if (isSingleDamageAction) {
                guardianInfo = findGuardian(this.world, finalTargetId);
                if (guardianInfo) {
                    finalTargetId = guardianInfo.id;
                    finalTargetPartKey = guardianInfo.partKey;
                    currentTargetParts = this.getCachedComponent(finalTargetId, Parts);
                    targetLegs = currentTargetParts ? currentTargetParts.legs : null;
                }
            }

            const outcome = CombatCalculator.resolveHitOutcome({
                world: this.world,
                attackerId: attackerId,
                targetId: finalTargetId,
                attackingPart: attackingPart,
                targetLegs: targetLegs,
                initialTargetPartKey: finalTargetPartKey
            });
            finalTargetPartKey = outcome.finalTargetPartKey;

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
     */
    _getCombatComponents(attackerId) {
        const action = this.getCachedComponent(attackerId, Action);
        if (!action) return null;

        const attackerInfo = this.getCachedComponent(attackerId, PlayerInfo);
        const attackerParts = this.getCachedComponent(attackerId, Parts);
        if (!attackerInfo || !attackerParts) {
            return null;
        }

        if (this.isValidEntity(action.targetId)) {
            const targetParts = this.getCachedComponent(action.targetId, Parts);
            return { action, attackerInfo, attackerParts, targetParts };
        }

        return { action, attackerInfo, attackerParts, targetParts: null };
    }
    
    update(deltaTime) {
    }
}