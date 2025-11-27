/**
 * @file 行動決定ユーティリティ
 */
import { GameEvents } from '../../common/events.js';
import { Parts } from '../components/index.js';
import { isValidTarget } from './queryUtils.js';
import { TargetTiming } from '../common/constants.js';

export function decideAndEmitAction(world, entityId, partKey, target = null) {
    const parts = world.getComponent(entityId, Parts);

    if (!parts || !partKey || !parts[partKey] || parts[partKey].isBroken) {
        console.warn(`decideAndEmitAction: Invalid or broken part selected for entity ${entityId}. Re-queueing.`);
        world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
        return;
    }

    const selectedPart = parts[partKey];

    if (selectedPart.targetTiming === TargetTiming.POST_MOVE) {
        world.emit(GameEvents.ACTION_SELECTED, {
            entityId,
            partKey,
            targetId: null,
            targetPartKey: null
        });
        return;
    }

    if (selectedPart.targetScope?.endsWith('_SINGLE') && !isValidTarget(world, target?.targetId, target?.targetPartKey)) {
        console.error(`decideAndEmitAction: A valid target was expected but not found. Action may fail.`, {entityId, partKey, target});
    }

    world.emit(GameEvents.ACTION_SELECTED, {
        entityId,
        partKey,
        targetId: target ? target.targetId : null,
        targetPartKey: target ? target.targetPartKey : null
    });
}