import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../context/index.js';
import { Action, ActiveEffects } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { BattlePhase, ActionCancelReason } from '../../common/constants.js';
import { EffectType } from '../../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';
import { findGuardian, isValidTarget } from '../../utils/queryUtils.js';
import { effectStrategies } from '../../effects/effectStrategies.js';
import { effectApplicators } from '../../effects/applicators/applicatorIndex.js';

export class ActionResolutionSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.effectApplicators = effectApplicators;
        this.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    update(deltaTime) {}
    
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
        
        const targetContext = this._determineFinalTarget(components, attackerId);
        if (targetContext.shouldCancel) {
            this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: attackerId, reason: ActionCancelReason.TARGET_LOST });
            return;
        }

        const outcome = this._calculateCombatOutcome(attackerId, components, targetContext);

        const resolvedEffects = this._processEffects(attackerId, components, targetContext, outcome);
        
        this._applyEffectsAndNotify(attackerId, components, targetContext, outcome, resolvedEffects);
    }

    _determineFinalTarget(components, attackerId) {
        const { action, attackingPart } = components;
        
        const isTargetRequired = attackingPart.targetScope && (attackingPart.targetScope.endsWith('_SINGLE') || attackingPart.targetScope.endsWith('_TEAM'));
        
        if (isTargetRequired && !attackingPart.isSupport && !isValidTarget(this.world, action.targetId, action.targetPartKey)) {
            console.warn(`ActionResolutionSystem: Target for entity ${attackerId} is no longer valid. Cancelling.`);
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

    _applyEffectsAndNotify(attackerId, components, targetContext, outcome, resolvedEffects) {
        const { attackingPart } = components;
        const { finalTargetId, guardianInfo } = targetContext;

        const appliedEffects = this._applyAllEffects({ resolvedEffects, guardianInfo });
        
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
                console.warn(`ActionResolutionSystem: No applicator for "${effect.type}".`);
                continue;
            }

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