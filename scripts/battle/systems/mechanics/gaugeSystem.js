/**
 * @file GaugeSystem.js
 * @description ゲージ更新システム。
 * 機動・推進計算時のパーツデータ参照をQueryService経由に修正。
 */
import { Gauge, BattleSequenceState, SequencePending, PauseState, IsCharging, IsCooldown } from '../../components/index.js';
import { GaugeFullTag } from '../../components/Requests.js';
import { Parts } from '../../../components/index.js';
import { BattleFlowState } from '../../components/BattleFlowState.js';
import { BattlePhase } from '../../common/constants.js';
import { System } from '../../../../engine/core/System.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { QueryService } from '../../services/QueryService.js';

export class GaugeSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const battleFlowState = this.world.getSingletonComponent(BattleFlowState);
        const isSequenceRunning =
            this.getEntities(SequencePending).length > 0 ||
            this.getEntities(BattleSequenceState).length > 0;

        if (isSequenceRunning) {
            return;
        }

        const isPaused = this.getEntities(PauseState).length > 0;

        const activePhases = [
            BattlePhase.TURN_START,
            BattlePhase.ACTION_SELECTION,
            BattlePhase.ACTION_EXECUTION,
            BattlePhase.TURN_END,
        ];

        if (!activePhases.includes(battleFlowState.phase) || isPaused) {
            return;
        }

        if (battleFlowState.currentActorId !== null) {
            return;
        }

        const entities = this.getEntities(Gauge, Parts);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);

            if (gauge.type !== 'ACTION') {
                continue;
            }

            if (this.world.getComponent(entityId, GaugeFullTag)) {
                continue;
            }

            const isMoving = this.world.getComponent(entityId, IsCharging) || this.world.getComponent(entityId, IsCooldown);

            if (!gauge.isActive || !isMoving || (gauge.statusFlags.has('FROZEN') || gauge.statusFlags.has('STOPPED'))) {
                continue;
            }

            const parts = this.world.getComponent(entityId, Parts);
            const legsData = QueryService.getPartData(this.world, parts.legs);
            
            const mobility = legsData?.mobility || 0;
            const propulsion = legsData?.propulsion || 0;
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
                this.world.addComponent(entityId, new GaugeFullTag());
            }
        }
    }
}