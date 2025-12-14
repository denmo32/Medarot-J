import { Gauge, GameState, BattleSequenceState, SequencePending, PauseState } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { PhaseState } from '../../components/PhaseState.js';
import { BattlePhase } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { System } from '../../../../engine/core/System.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';

export class GaugeSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
        // this.isPaused = false; // 廃止: PauseState コンポーネントを使用
    }

    update(deltaTime) {
        // シーケンス実行中はゲージを停止
        const isSequenceRunning = 
            this.getEntities(SequencePending).length > 0 ||
            this.getEntities(BattleSequenceState).length > 0;

        if (isSequenceRunning) {
            return;
        }

        // 一時停止状態のチェック
        const isPaused = this.getEntities(PauseState).length > 0;

        const activePhases = [
            BattlePhase.TURN_START,
            BattlePhase.ACTION_SELECTION,
            BattlePhase.ACTION_EXECUTION,
            BattlePhase.TURN_END,
        ];

        if (!activePhases.includes(this.phaseState.phase) || isPaused) {
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

            if (gauge.type !== 'ACTION') {
                continue;
            }

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
}