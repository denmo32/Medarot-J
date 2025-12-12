/**
 * @file commandExecutor.js
 * @description 状態変更コマンドを解釈し、Worldに適用する純粋な関数群。
 * 全ての副作用（コンポーネントの書き換え）をここに集約する。
 */
import { GameState, Gauge, Action, Position, ActiveEffects } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { PlayerStateType } from '../common/constants.js';
import { TeamID, EffectType } from '../../common/constants.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../../common/events.js';
import { CombatCalculator } from './CombatCalculator.js';
import { EffectService } from '../services/EffectService.js';

// ゲージを加算すべき状態のリスト
const ACTIVE_GAUGE_STATES = new Set([
    PlayerStateType.CHARGING,
    PlayerStateType.SELECTED_CHARGING
]);

/**
 * 状態遷移コマンド
 * @param {World} world 
 * @param {object} command 
 */
function transitionTo(world, command) {
    const { targetId, newState } = command;
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
        snapToActionLine(world, { targetId });
    }
}

/**
 * アクションラインへのスナップコマンド
 * @param {World} world 
 * @param {object} command 
 */
function snapToActionLine(world, command) {
    const { targetId } = command;
    const position = world.getComponent(targetId, Position);
    const playerInfo = world.getComponent(targetId, PlayerInfo);

    if (!position || !playerInfo) return;

    position.x = playerInfo.teamId === TeamID.TEAM1
        ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
        : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
}

/**
 * プレイヤー破壊コマンド
 * @param {World} world 
 * @param {object} command 
 */
function setPlayerBroken(world, command) {
    const { targetId } = command;
    transitionTo(world, { targetId, newState: PlayerStateType.BROKEN });

    const playerInfo = world.getComponent(targetId, PlayerInfo);
    world.addComponent(targetId, new Action());

    if (playerInfo) {
        world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId, teamId: playerInfo.teamId });
    }
}

/**
 * ゲージ満タン処理コマンド
 * @param {World} world 
 * @param {object} command 
 */
function handleGaugeFull(world, command) {
    const { targetId } = command;
    const gameState = world.getComponent(targetId, GameState);
    if (!gameState) return;

    if (gameState.state === PlayerStateType.CHARGING) {
        transitionTo(world, { targetId, newState: PlayerStateType.READY_SELECT });
        world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId: targetId });
    } 
    else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
        transitionTo(world, { targetId, newState: PlayerStateType.READY_EXECUTE });
    }
}

/**
 * クールダウン移行コマンド
 * @param {World} world 
 * @param {object} command 
 */
function transitionToCooldown(world, command) {
    const { targetId } = command;
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

    transitionTo(world, { targetId, newState: PlayerStateType.CHARGING });
    
    if (gauge) {
        gauge.value = 0;
        gauge.currentSpeed = 0;
    }
    
    world.addComponent(targetId, new Action());
    world.emit(GameEvents.COOLDOWN_TRANSITION_COMPLETED, { entityId: targetId });
}

/**
 * クールダウンへリセットするコマンド
 * @param {World} world 
 * @param {object} command 
 */
function resetToCooldown(world, command) {
    const { targetId, options = {} } = command;
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
    
    transitionTo(world, { targetId, newState: PlayerStateType.CHARGING });
    
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

/**
 * コンポーネント更新コマンド
 * @param {World} world 
 * @param {object} command 
 */
function updateComponent(world, command) {
    const component = world.getComponent(command.targetId, command.componentType);
    if (component) {
        _deepMerge(component, command.updates);
    }
}

/**
 * カスタム更新コマンド
 * @param {World} world 
 * @param {object} command 
 */
function customUpdate(world, command) {
    const component = world.getComponent(command.targetId, command.componentType);
    if (component && command.customHandler) {
        command.customHandler(component, world);
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

const commandHandlers = {
    'TRANSITION_STATE': transitionTo,
    'SNAP_TO_ACTION_LINE': snapToActionLine,
    'SET_PLAYER_BROKEN': setPlayerBroken,
    'HANDLE_GAUGE_FULL': handleGaugeFull,
    'TRANSITION_TO_COOLDOWN': transitionToCooldown,
    'RESET_TO_COOLDOWN': resetToCooldown,
    'UPDATE_COMPONENT': updateComponent,
    'CUSTOM_UPDATE': customUpdate,
};

/**
 * コマンドの配列を実行する
 * @param {World} world 
 * @param {Array<object>} commands 
 */
export function executeCommands(world, commands) {
    if (!commands || !Array.isArray(commands)) return;
    for (const cmd of commands) {
        const handler = commandHandlers[cmd.type];
        if (handler) {
            handler(world, cmd);
        } else {
            console.warn(`Unknown command type: ${cmd.type}`);
        }
    }
}