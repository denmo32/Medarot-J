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
            // ゲージが進行するべきフェーズリストからACTION_RESOLUTIONを削除
            const activePhases = [
                BattlePhase.TURN_START,
                BattlePhase.ACTION_SELECTION,
                BattlePhase.ACTION_EXECUTION,
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

                const gauge = this.world.getComponent(entityId, Gauge);
                const mobility = parts.legs?.mobility || 0;
                const propulsion = parts.legs?.propulsion || 0;
                const speedMultiplier = gauge.speedMultiplier || 1.0;
                const gaugeConfig = CONFIG.FORMULAS.GAUGE;

                // 1. 加速度と最高速度を決定 (1updateあたりの値として)
                const acceleration = gaugeConfig.BASE_ACCELERATION + (mobility * gaugeConfig.MOBILITY_TO_ACCELERATION);
                const maxSpeed = gaugeConfig.BASE_MAX_SPEED + (propulsion * gaugeConfig.PROPULSION_TO_MAX_SPEED);
                
                // 2. 速度を更新し、最高速度で制限
                gauge.currentSpeed += acceleration;
                if (gauge.currentSpeed > maxSpeed) {
                    gauge.currentSpeed = maxSpeed;
                }
                
                // 3. ゲージを更新
                const timeFactor = deltaTime / CONFIG.UPDATE_INTERVAL;
                const increment = (gauge.currentSpeed / speedMultiplier) * timeFactor;
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