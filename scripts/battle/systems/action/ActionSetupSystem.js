import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Action, GameState, Gauge, Parts } from '../../components/index.js';
import { PlayerStateType } from '../../../config/constants.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';

export class ActionSetupSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
    }

    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        if (!partKey || !parts?.[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionSetupSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
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
        gauge.currentSpeed = 0;
        gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: selectedPart, factorType: 'charge' });
    }
}