import { Gauge, GameState, BattleSequenceState, SequencePending } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { PhaseState } from '../../components/PhaseState.js'; // 修正
import { BattlePhase } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { System } from '../../../../engine/core/System.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';

export class GaugeSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState); // 修正
        this.isPaused = false;

        this.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    update(deltaTime) {
        // シーケンス実行中はゲージを停止
        const isSequenceRunning = 
            this.getEntities(SequencePending).length > 0 ||
            this.getEntities(BattleSequenceState).length > 0;

        if (isSequenceRunning) {
            return;
        }

        const activePhases = [
            BattlePhase.TURN_START,
            BattlePhase.ACTION_SELECTION,
            BattlePhase.ACTION_EXECUTION,
            BattlePhase.TURN_END,
        ];

        if (!activePhases.includes(this.phaseState.phase) || this.isPaused) { // 修正
            return;
        }

        const entitiesWithState = this.getEntities(GameState);
        const hasActionQueued = entitiesWithState.some(entityId => {
            const gameState = this.world.getComponent(entityId, GameState);
            return gameState.state === 'ready_select' || gameState.state === 'ready_execute';
        });

        if (hasActionQueued) {
            return;
        }

        const entities = this.getEntities(Gauge, Parts);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);

            // 行動ゲージ以外は無視 (汎用性確保)
            if (gauge.type !== 'ACTION') {
                continue;
            }

            // フリーズチェック (拡張性確保)
            if (!gauge.isActive || gauge.isFrozen()) {
                continue;
            }

            const parts = this.world.getComponent(entityId, Parts);
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