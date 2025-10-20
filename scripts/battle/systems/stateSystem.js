import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType, ModalType, BattlePhase, TeamID, EffectType, EffectScope, PartInfo, TargetTiming } from '../common/constants.js';
import { isValidTarget } from '../utils/queryUtils.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * エンティティの「状態」を管理するステートマシンとしての役割を担うシステム。
 */
export class StateSystem {
    constructor(world) {
        this.world = world;
        this.battleContext = this.world.getSingletonComponent(BattleContext);

        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
        // [修正] ATTACK_SEQUENCE_COMPLETED を購読するように戻す（これは行動単位の完了通知として利用）
        this.world.on(GameEvents.ATTACK_SEQUENCE_COMPLETED, this.onAttackSequenceCompleted.bind(this));
        this.world.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.world.on(GameEvents.EFFECT_EXPIRED, this.onEffectExpired.bind(this));
    }
    
    onPlayerBroken(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        if (gameState) {
            gameState.state = PlayerStateType.BROKEN;
        }
        if (gauge) {
            gauge.value = 0;
        }
        this.world.addComponent(entityId, new Action());
    }


    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        if (!partKey || !parts[partKey] || parts[partKey].isBroken) {
            console.warn(`StateSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const selectedPart = parts[partKey];

        action.partKey = partKey;
        action.type = selectedPart.action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        action.targetTiming = selectedPart.targetTiming;

        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        gauge.value = 0;
        gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: selectedPart, factorType: 'charge' });
    }


    onActionExecuted(detail) {
        const { appliedEffects, attackerId } = detail;
        if (!appliedEffects || appliedEffects.length === 0) {
            return;
        }

        for (const effect of appliedEffects) {
            if (effect.type === EffectType.APPLY_GLITCH && effect.wasSuccessful) {
                this.resetEntityStateToCooldown(effect.targetId, { interrupted: true });
            } 
            else if (effect.type === EffectType.APPLY_GUARD) {
                const gameState = this.world.getComponent(attackerId, GameState);
                if (gameState) {
                    gameState.state = PlayerStateType.GUARDING;
                    
                    const position = this.world.getComponent(attackerId, Position);
                    const playerInfo = this.world.getComponent(attackerId, PlayerInfo);
                    if (position && playerInfo) {
                        position.x = playerInfo.teamId === TeamID.TEAM1
                            ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                            : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
                    }
                }
            }
        }
    }

    onAttackSequenceCompleted(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);

        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            this.world.addComponent(entityId, new Action());
            return;
        }

        const gauge = this.world.getComponent(entityId, Gauge);
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);

        if (action && action.partKey && parts && gauge) {
            const usedPart = parts[action.partKey];
            if (usedPart) {
                gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: usedPart, factorType: 'cooldown' });
            }
        } else if (gauge) {
            gauge.speedMultiplier = 1.0;
        }
        this.resetEntityStateToCooldown(entityId);
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gauge || !gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
            gameState.state = PlayerStateType.READY_SELECT;
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            gameState.state = PlayerStateType.READY_EXECUTE;

            const position = this.world.getComponent(entityId, Position);
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);

            if (playerInfo.teamId === TeamID.TEAM1) {
                position.x = CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1;
            } else {
                position.x = CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
            }
        }
    }
    
    onActionCancelled(detail) {
        const { entityId } = detail;
        this.resetEntityStateToCooldown(entityId, { interrupted: true });
    }

    onEffectExpired(detail) {
        const { entityId, effect } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        
        if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
            const parts = this.world.getComponent(entityId, Parts);
            const guardPart = parts[effect.partKey];
            if (guardPart?.isBroken) {
                 this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
            }
            
            const gauge = this.world.getComponent(entityId, Gauge);
            if(gauge) gauge.speedMultiplier = 1.0;
            
            this.resetEntityStateToCooldown(entityId);
        }
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
        
        if (!interrupted && gauge) {
        }

        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            if (interrupted) {
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
        }
        if (action) {
            this.world.addComponent(entityId, new Action());
        }
    }

    update(deltaTime) {
    }
}