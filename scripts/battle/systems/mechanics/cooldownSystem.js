import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Action, GameState, Gauge, ActiveEffects } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { PlayerStateType } from '../../common/constants.js';
import { EffectType } from '../../../common/constants.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';

export class CooldownSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.REQUEST_COOLDOWN_TRANSITION, this.onCooldownTransitionRequested.bind(this));
        this.on(GameEvents.REQUEST_RESET_TO_COOLDOWN, this.onResetToCooldownRequested.bind(this));
    }

    onCooldownTransitionRequested(detail) {
        const { entityId } = detail;
        this.transitionToCooldown(entityId);
        
        // 完了通知
        this.world.emit(GameEvents.COOLDOWN_TRANSITION_COMPLETED, { entityId });
    }
    
    onResetToCooldownRequested(detail) {
        const { entityId, options } = detail;
        this.resetEntityStateToCooldown(entityId, options);
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

        this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId, newState: PlayerStateType.CHARGING });
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
        
        this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId, newState: PlayerStateType.CHARGING });
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