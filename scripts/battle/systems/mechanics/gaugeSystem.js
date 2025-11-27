import { Gauge, GameState } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { System } from '../../../../engine/core/System.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';

export class GaugeSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.isPaused = false;
        
        this.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    update(deltaTime) {
        // シーケンス実行中はゲージ更新を停止
        if (this.battleContext.isSequenceRunning) {
            return;
        }

        const activePhases = [
            BattlePhase.TURN_START,
            BattlePhase.ACTION_SELECTION,
            BattlePhase.ACTION_EXECUTION,
            BattlePhase.TURN_END,
        ];

        if (!activePhases.includes(this.battleContext.phase) || this.isPaused) {
            return;
        }

        // 行動選択待ちのアクターがいる場合も停止（従来通り）
        const entitiesWithState = this.getEntities(GameState);
        const hasActionQueued = entitiesWithState.some(entityId => {
            const gameState = this.world.getComponent(entityId, GameState);
            return gameState.state === PlayerStateType.READY_SELECT || gameState.state === PlayerStateType.READY_EXECUTE;
        });

        if (hasActionQueued) {
            return;
        }

        const entities = this.getEntities(Gauge, GameState, Parts);

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
                PlayerStateType.AWAITING_ANIMATION // これも追加
            ];
            if (statesToPause.includes(gameState.state)) {
                continue;
            }

            const gauge = this.world.getComponent(entityId, Gauge);
            const mobility = parts.legs?.mobility || 0;
            const propulsion = parts.legs?.propulsion || 0;
            const speedMultiplier = gauge.speedMultiplier || 1.0;

            const { nextSpeed, increment } = CombatCalculator.calculateGaugeUpdate({
                currentSpeed: gauge.currentSpeed,
                mobility,
                propulsion,
                speedMultiplier,
                deltaTime
            });
            
            gauge.currentSpeed = nextSpeed;
            gauge.value += increment;

            if (gauge.value >= gauge.max) {
                gauge.value = gauge.max;
                this.world.emit(GameEvents.GAUGE_FULL, { entityId });
            }
        }
    }
    
    onPauseGame() { this.isPaused = true; }
    onResumeGame() { this.isPaused = false; }
}