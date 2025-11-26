import { Gauge, GameState, Parts } from '../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { CONFIG } from '../../../config/gameConfig.js';
import { PlayerStateType, BattlePhase, PartInfo } from '../../../config/constants.js';
import { GameEvents } from '../../../common/events.js';
import { System } from '../../../../engine/core/System.js';

export class GaugeSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.isPaused = false;
        
        this.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    update(deltaTime) {
        const activePhases = [
            BattlePhase.TURN_START,
            BattlePhase.ACTION_SELECTION,
            BattlePhase.ACTION_EXECUTION,
            BattlePhase.TURN_END,
        ];

        if (!activePhases.includes(this.battleContext.phase) || this.isPaused) {
            return;
        }

        const entitiesWithState = this.getEntities(GameState);
        const hasActionQueued = entitiesWithState.some(entityId => {
            const gameState = this.world.getComponent(entityId, GameState);
            return gameState.state === PlayerStateType.READY_SELECT || gameState.state === PlayerStateType.READY_EXECUTE;
        });

        if (hasActionQueued) {
            return;
        }

        const entities = this.getEntities(Gauge, GameState, Parts);

        const { 
            BASE_ACCELERATION, 
            MOBILITY_TO_ACCELERATION, 
            BASE_MAX_SPEED, 
            PROPULSION_TO_MAX_SPEED 
        } = CONFIG.FORMULAS.GAUGE;
        
        const timeFactor = deltaTime / CONFIG.UPDATE_INTERVAL;

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

            const acceleration = BASE_ACCELERATION + (mobility * MOBILITY_TO_ACCELERATION);
            const maxSpeed = BASE_MAX_SPEED + (propulsion * PROPULSION_TO_MAX_SPEED);
            
            gauge.currentSpeed = Math.min(gauge.currentSpeed + acceleration, maxSpeed);
            
            const increment = (gauge.currentSpeed / speedMultiplier) * timeFactor;
            gauge.value += increment;

            if (gauge.value >= gauge.max) {
                gauge.value = gauge.max;
                this.world.emit(GameEvents.GAUGE_FULL, { entityId });
            }
        }
    }
    
    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}