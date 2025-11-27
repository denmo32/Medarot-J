/**
 * @file 戦闘解決ロジック (Service)
 * @description ActionResolutionSystemから抽出された、純粋な戦闘計算と効果適用のロジッククラス。
 * Systemを継承せず、BattleSequenceSystemから同期的に呼び出されます。
 */
import { Action, ActiveEffects } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { GameEvents } from '../../common/events.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { findGuardian, isValidTarget } from '../utils/queryUtils.js';
import { effectStrategies } from '../effects/effectStrategies.js';
import { effectApplicators } from '../effects/applicators/applicatorIndex.js';

export class BattleResolver {
    constructor(world) {
        this.world = world;
        this.effectApplicators = effectApplicators;
    }

    /**
     * アクションの結果を計算し、効果を適用します。
     * @param {number} attackerId 
     * @returns {object} 結果データ
     */
    resolve(attackerId) {
        const components = this._getCombatComponents(attackerId);
        
        // コンポーネントが不足している場合はスキップ
        if (!components) {
            return { attackerId, isCancelled: true };
        }
        
        const targetContext = this._determineFinalTarget(components, attackerId);
        
        if (targetContext.shouldCancel) {
            return { attackerId, isCancelled: true, cancelReason: 'TARGET_LOST' };
        }

        const outcome = this._calculateCombatOutcome(attackerId, components, targetContext);
        const resolvedEffects = this._processEffects(attackerId, components, targetContext, outcome);
        const appliedEffects = this._applyAllEffects({ resolvedEffects, guardianInfo: targetContext.guardianInfo });
        
        const resultData = {
            attackerId,
            targetId: targetContext.finalTargetId,
            attackingPart: components.attackingPart,
            isSupport: components.attackingPart.isSupport,
            guardianInfo: targetContext.guardianInfo,
            outcome,
            appliedEffects,
            isCancelled: false
        };

        // 統合イベント発行（履歴記録などのため）
        this.world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, resultData);
        
        return resultData;
    }

    _determineFinalTarget(components, attackerId) {
        const { action, attackingPart } = components;
        
        const isTargetRequired = attackingPart.targetScope && (attackingPart.targetScope.endsWith('_SINGLE') || attackingPart.targetScope.endsWith('_TEAM'));
        
        if (isTargetRequired && !attackingPart.isSupport && !isValidTarget(this.world, action.targetId, action.targetPartKey)) {
            console.warn(`BattleResolver: Target for entity ${attackerId} is no longer valid.`);
            return { shouldCancel: true };
        }

        let finalTargetId = action.targetId;
        let finalTargetPartKey = action.targetPartKey;
        let guardianInfo = null;

        if (!attackingPart.isSupport && finalTargetId !== null) {
            const foundGuardian = findGuardian(this.world, finalTargetId);
            if (foundGuardian) {
                guardianInfo = foundGuardian;
                finalTargetId = guardianInfo.id;
                finalTargetPartKey = guardianInfo.partKey;
            }
        }

        const targetLegs = this.world.getComponent(finalTargetId, Parts)?.legs;

        return { 
            finalTargetId, 
            finalTargetPartKey, 
            targetLegs, 
            guardianInfo, 
            shouldCancel: false 
        };
    }

    _calculateCombatOutcome(attackerId, components, targetContext) {
        const { attackingPart } = components;
        const { finalTargetId, finalTargetPartKey, targetLegs } = targetContext;

        return CombatCalculator.resolveHitOutcome({
            world: this.world,
            attackerId,
            targetId: finalTargetId,
            attackingPart,
            targetLegs,
            initialTargetPartKey: finalTargetPartKey
        });
    }

    _processEffects(attackerId, components, targetContext, outcome) {
        const { action, attackingPart, attackerInfo, attackerParts } = components;
        const { finalTargetId } = targetContext;
        const resolvedEffects = [];

        if (!outcome.isHit && finalTargetId) {
            return resolvedEffects;
        }

        for (const effectDef of attackingPart.effects || []) {
            const strategy = effectStrategies[effectDef.type];
            if (!strategy) continue;

            const result = strategy({
                world: this.world,
                sourceId: attackerId,
                targetId: finalTargetId,
                effect: effectDef,
                part: attackingPart,
                partKey: action.partKey,
                partOwner: { info: attackerInfo, parts: attackerParts },
                outcome,
            });

            if (result) {
                result.penetrates = attackingPart.penetrates || false;
                resolvedEffects.push(result);
            }
        }
        return resolvedEffects;
    }

    _applyAllEffects({ resolvedEffects, guardianInfo }) {
        const appliedEffects = [];
        const effectQueue = [...resolvedEffects];

        if (guardianInfo) {
            this._consumeGuardCount(guardianInfo.id);
        }

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            
            const applicator = this.effectApplicators[effect.type];
            if (!applicator) {
                console.warn(`BattleResolver: No applicator for "${effect.type}".`);
                continue;
            }

            // 副作用を分離したApplicatorを呼び出し
            const result = applicator({ world: this.world, effect });

            if (result) {
                // 結果に含まれるイベントを発行
                if (result.events) {
                    result.events.forEach(event => this.world.emit(event.type, event.payload));
                }

                appliedEffects.push(result);
                if (result.nextEffect) {
                    effectQueue.unshift(result.nextEffect);
                }
            }
        }
        return appliedEffects;
    }

    _consumeGuardCount(guardianId) {
        const activeEffects = this.world.getComponent(guardianId, ActiveEffects);
        if (!activeEffects) return;

        const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
        if (guardEffect) {
            guardEffect.count--;
            if (guardEffect.count <= 0) {
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId: guardianId, effect: guardEffect });
            }
        }
    }
    
    _getCombatComponents(attackerId) {
        const action = this.world.getComponent(attackerId, Action);
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerParts = this.world.getComponent(attackerId, Parts);
        
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        
        const attackingPart = attackerParts[action.partKey];
        if (!attackingPart) return null;

        return { action, attackerInfo, attackerParts, attackingPart };
    }
}