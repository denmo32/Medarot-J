import { Gauge, GameState, Parts } from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { CONFIG } from '../common/config.js';
import { PlayerStateType, BattlePhase, PartInfo } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { BaseSystem } from '../../core/baseSystem.js';
import { ErrorHandler } from '../utils/errorHandler.js';

export class GaugeSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.isPaused = false;
        
        this.world.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    update(deltaTime) {
        try {
            // [修正] ゲージが進行するべきフェーズをTURN_START以降に限定する
            const activePhases = [
                BattlePhase.TURN_START,
                BattlePhase.ACTION_SELECTION,
                BattlePhase.ACTION_EXECUTION,
                BattlePhase.ACTION_RESOLUTION,
                BattlePhase.TURN_END,
            ];

            if (!activePhases.includes(this.battleContext.phase) || this.isPaused) {
                return;
            }

            const entitiesWithState = this.world.getEntitiesWith(GameState);
            const hasActionQueued = entitiesWithState.some(entityId => {
                const gameState = this.world.getComponent(entityId, GameState);
                return gameState.state === PlayerStateType.READY_SELECT || gameState.state === PlayerStateType.READY_EXECUTE;
            });

            if (hasActionQueued) {
                return;
            }

            const entities = this.world.getEntitiesWith(Gauge, GameState, Parts);

            for (const entityId of entities) {
                const gauge = this.world.getComponent(entityId, Gauge);
                const gameState = this.world.getComponent(entityId, GameState);
                const parts = this.world.getComponent(entityId, Parts);

                if (parts[PartInfo.HEAD.key]?.isBroken) {
                    continue;
                }

                const statesToPause = [
                    PlayerStateType.READY_SELECT, 
                    PlayerStateType.READY_EXECUTE, 
                    PlayerStateType.COOLDOWN_COMPLETE, 
                    PlayerStateType.BROKEN,
                    PlayerStateType.GUARDING,
                ];
                if (statesToPause.includes(gameState.state)) {
                    continue;
                }

                const propulsion = parts.legs?.propulsion || 1;
                const speedMultiplier = gauge.speedMultiplier || 1.0;
                const increment = (propulsion / CONFIG.FORMULAS.GAUGE.GAUGE_INCREMENT_DIVISOR) * (deltaTime / CONFIG.UPDATE_INTERVAL) / speedMultiplier;
                gauge.value += increment;

                if (gauge.value >= gauge.max) {
                    gauge.value = gauge.max;
                    this.world.emit(GameEvents.GAUGE_FULL, { entityId });
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'GaugeSystem.update', deltaTime });
        }
    }
    
    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}