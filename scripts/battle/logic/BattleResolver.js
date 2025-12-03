/**
 * @file BattleResolver.js
 * @description 戦闘計算ロジック。イベント発行を最小限にし、純粋なデータ計算に集中する。
 * ターゲット解決などの複雑なルールは TargetingService に委譲。
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
     * アクションの結果を計算します。
     * 副作用（HP減少など）は行わず、計算結果のみを返します。
     * @param {number} attackerId 
     * @returns {object} 結果データ
     */
    resolve(attackerId) {
        const components = this._getCombatComponents(attackerId);
        
        if (!components) {
            return { attackerId, isCancelled: true, cancelReason: 'INTERRUPTED' };
        }
        
        const { action, attackingPart } = components;

        // ターゲット解決 (TargetingServiceに委譲)
        const targetContext = TargetingService.resolveActualTarget(
            this.world, 
            attackerId, 
            action.targetId, 
            action.targetPartKey, 
            attackingPart.isSupport
        );
        
        if (targetContext.shouldCancel) {
            return { attackerId, isCancelled: true, cancelReason: 'TARGET_LOST' };
        }
        
        // ターゲット情報にtargetLegsを追加（計算で必要）
        if (targetContext.finalTargetId !== null) {
            targetContext.targetLegs = this.world.getComponent(targetContext.finalTargetId, Parts)?.legs;
        }

        const outcome = this._calculateCombatOutcome(attackerId, components, targetContext);
        const resolvedEffects = this._processEffects(attackerId, components, targetContext, outcome);
        
        // ガードが発動した場合は、ガード消費エフェクトを追加
        if (targetContext.guardianInfo) {
            resolvedEffects.push({
                type: EffectType.CONSUME_GUARD,
                targetId: targetContext.guardianInfo.id,
                partKey: targetContext.guardianInfo.partKey
            });
        }

        const appliedEffects = this._calculateAppliedEffects({ resolvedEffects, guardianInfo: targetContext.guardianInfo });
        
        // フラグの集約 (何が起きたか)
        const summary = {
            isGuardBroken: appliedEffects.some(e => e.isGuardBroken),
            isGuardExpired: appliedEffects.some(e => e.isExpired && e.type === EffectType.CONSUME_GUARD),
        };

        return {
            attackerId,
            intendedTargetId: action.targetId, // 元々のターゲット
            targetId: targetContext.finalTargetId, // 実際に当たったターゲット
            attackingPart: components.attackingPart,
            isSupport: components.attackingPart.isSupport,
            guardianInfo: targetContext.guardianInfo,
            outcome,
            appliedEffects,
            summary, 
            isCancelled: false
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

    _calculateAppliedEffects({ resolvedEffects, guardianInfo }) {
        const appliedEffects = [];
        const effectQueue = [...resolvedEffects];

        while (effectQueue.length > 0) {
            const effect = effectQueue.shift();
            
            const applicator = this.effectApplicators[effect.type];
            if (!applicator) continue;

            const result = applicator({ world: this.world, effect });

            if (result) {
                appliedEffects.push(result);
                if (result.nextEffect) {
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
        
        const attackingPart = attackerParts[action.partKey];
        if (!attackingPart) return null;

        return { action, attackerInfo, attackerParts, attackingPart };
    }
}