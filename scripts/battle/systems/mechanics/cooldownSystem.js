import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Action, GameState, Gauge, Parts, ActiveEffects } from '../../components/index.js';
import { PlayerStateType, EffectType } from '../../common/constants.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';

export class CooldownSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.ACTION_COMPLETED, this.onActionCompleted.bind(this));
        this.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.on(GameEvents.EFFECT_EXPIRED, this.onEffectExpired.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }

    onActionCompleted(detail) {
        this.transitionToCooldown(detail.entityId);
    }
    
    onActionCancelled(detail) {
        this.resetEntityStateToCooldown(detail.entityId, { interrupted: true });
    }

    onHpBarAnimationCompleted(detail) {
        const { appliedEffects } = detail;
        if (!appliedEffects) return;

        for (const effect of appliedEffects) {
            if (!effect.isPartBroken) continue;
            
            const { targetId: entityId, partKey } = effect;
            const gameState = this.world.getComponent(entityId, GameState);

            if (gameState?.state !== PlayerStateType.GUARDING) {
                continue;
            }

            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (!activeEffects) continue;

            const isGuardPartBroken = activeEffects.effects.some(
                activeEffect => activeEffect.type === EffectType.APPLY_GUARD && activeEffect.partKey === partKey
            );

            if (isGuardPartBroken) {
                this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
                this.resetEntityStateToCooldown(entityId);
            }
        }
    }

    onEffectExpired(detail) {
        const { entityId, effect } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        
        if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
            this.resetEntityStateToCooldown(entityId);
        }
    }
    
    transitionToCooldown(entityId) {
        const parts = this.world.getComponent(entityId, Parts);
        if (parts?.head?.isBroken) return;

        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            this.world.addComponent(entityId, new Action());
            return;
        }

        const gauge = this.world.getComponent(entityId, Gauge);
        const action = this.world.getComponent(entityId, Action);

        if (action && action.partKey && parts && gauge) {
            const usedPart = parts[action.partKey];
            if (usedPart) {
                gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: usedPart, factorType: 'cooldown' });
            }
        } else if (gauge) {
            gauge.speedMultiplier = 1.0;
        }

        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            gauge.value = 0;
            gauge.currentSpeed = 0;
        }
        
        this.world.addComponent(entityId, new Action());
    }

    resetEntityStateToCooldown(entityId, options = {}) {
        const { interrupted = false } = options;
        const parts = this.world.getComponent(entityId, Parts);
        
        if (parts?.head?.isBroken) {
            return;
        }
        
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);
        const action = this.world.getComponent(entityId, Action);

        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }
        
        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            if (interrupted) {
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
            gauge.currentSpeed = 0;
            gauge.speedMultiplier = 1.0;
        }
        if (action) {
            this.world.addComponent(entityId, new Action());
        }
    }
}