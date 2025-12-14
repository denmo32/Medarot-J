/**
 * @file Command.js
 * @description コマンドパターンに基づく状態変更コマンドの基底クラスと具象クラス。
 */
import { GameState, Gauge, Action, Position, ActiveEffects } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { PlayerStateType, EffectType } from './constants.js';
import { TeamID } from '../../common/constants.js';
import { CONFIG } from './config.js';
import { GameEvents } from '../../common/events.js';
import { CombatCalculator } from '../logic/CombatCalculator.js';
import { EffectService } from '../services/EffectService.js';

// ゲージを加算すべき状態のリスト
const ACTIVE_GAUGE_STATES = new Set([
    PlayerStateType.CHARGING,
    PlayerStateType.SELECTED_CHARGING
]);

export class Command {
    /**
     * @param {string} type - コマンドの種類
     * @param {Object} data - コマンドに必要なデータ（targetId, newStateなど）
     */
    constructor(type, data) {
        this.type = type;
        this.data = data;
    }

    /**
     * コマンドを実行
     * @param {World} world
     */
    execute(world) {
        throw new Error('Command#execute must be overridden');
    }
}

export class TransitionStateCommand extends Command {
    constructor(data) {
        super('TRANSITION_STATE', data);
    }

    execute(world) {
        const { targetId, newState } = this.data;
        const gameState = world.getComponent(targetId, GameState);
        if (!gameState) return;

        gameState.state = newState;

        const gauge = world.getComponent(targetId, Gauge);
        if (gauge) {
            gauge.isActive = ACTIVE_GAUGE_STATES.has(newState);
            if (newState === PlayerStateType.BROKEN) {
                gauge.value = 0;
                gauge.currentSpeed = 0;
            }
        }

        if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
            new SnapToActionLineCommand({ targetId }).execute(world);
        }
    }
}

export class SnapToActionLineCommand extends Command {
    constructor(data) {
        super('SNAP_TO_ACTION_LINE', data);
    }

    execute(world) {
        const { targetId } = this.data;
        const position = world.getComponent(targetId, Position);
        const playerInfo = world.getComponent(targetId, PlayerInfo);

        if (!position || !playerInfo) return;

        position.x = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
            : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
    }
}

export class SetPlayerBrokenCommand extends Command {
    constructor(data) {
        super('SET_PLAYER_BROKEN', data);
    }

    execute(world) {
        const { targetId } = this.data;
        new TransitionStateCommand({ targetId, newState: PlayerStateType.BROKEN }).execute(world);

        const playerInfo = world.getComponent(targetId, PlayerInfo);
        world.addComponent(targetId, new Action());

        if (playerInfo) {
            world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId, teamId: playerInfo.teamId });
        }
    }
}

export class HandleGaugeFullCommand extends Command {
    constructor(data) {
        super('HANDLE_GAUGE_FULL', data);
    }

    execute(world) {
        const { targetId } = this.data;
        const gameState = world.getComponent(targetId, GameState);
        if (!gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            new TransitionStateCommand({ targetId, newState: PlayerStateType.READY_SELECT }).execute(world);
            world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId: targetId });
        }
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            new TransitionStateCommand({ targetId, newState: PlayerStateType.READY_EXECUTE }).execute(world);
        }
    }
}

export class TransitionToCooldownCommand extends Command {
    constructor(data) {
        super('TRANSITION_TO_COOLDOWN', data);
    }

    execute(world) {
        const { targetId } = this.data;
        const parts = world.getComponent(targetId, Parts);
        if (parts?.head?.isBroken) return;

        const gameState = world.getComponent(targetId, GameState);
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            world.addComponent(targetId, new Action());
            return;
        }

        const gauge = world.getComponent(targetId, Gauge);
        const action = world.getComponent(targetId, Action);

        if (action?.partKey && parts && gauge) {
            const usedPart = parts[action.partKey];
            if (usedPart) {
                const modifier = EffectService.getSpeedMultiplierModifier(world, targetId, usedPart);
                gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({
                    might: usedPart.might,
                    success: usedPart.success,
                    factorType: 'cooldown',
                    modifier: modifier
                });
            }
        } else if (gauge) {
            gauge.speedMultiplier = 1.0;
        }

        new TransitionStateCommand({ targetId, newState: PlayerStateType.CHARGING }).execute(world);

        if (gauge) {
            gauge.value = 0;
            gauge.currentSpeed = 0;
        }

        world.addComponent(targetId, new Action());
        world.emit(GameEvents.COOLDOWN_TRANSITION_COMPLETED, { entityId: targetId });
    }
}

export class ResetToCooldownCommand extends Command {
    constructor(data) {
        super('RESET_TO_COOLDOWN', data);
    }

    execute(world) {
        const { targetId, options = {} } = this.data;
        const { interrupted = false } = options;
        const parts = world.getComponent(targetId, Parts);
        if (parts?.head?.isBroken) return;

        const gameState = world.getComponent(targetId, GameState);
        const gauge = world.getComponent(targetId, Gauge);

        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = world.getComponent(targetId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }

        new TransitionStateCommand({ targetId, newState: PlayerStateType.CHARGING }).execute(world);

        if (gauge) {
            if (interrupted) {
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
            gauge.currentSpeed = 0;
            gauge.speedMultiplier = 1.0;
        }

        world.addComponent(targetId, new Action());
    }
}

export class UpdateComponentCommand extends Command {
    constructor(data) {
        super('UPDATE_COMPONENT', data);
    }

    execute(world) {
        const component = world.getComponent(this.data.targetId, this.data.componentType);
        if (component) {
            _deepMerge(component, this.data.updates);
        }
    }
}

export class CustomUpdateCommand extends Command {
    constructor(data) {
        super('CUSTOM_UPDATE', data);
    }

    execute(world) {
        const component = world.getComponent(this.data.targetId, this.data.componentType);
        if (component && this.data.customHandler) {
            this.data.customHandler(component, world);
        }
    }
}

function _deepMerge(target, source) {
    for (const key in source) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
            _deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
}