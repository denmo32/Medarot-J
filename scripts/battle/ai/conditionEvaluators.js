/**
 * @file AI思考ルーチン条件評価関数
 */
import { TargetingService } from '../services/TargetingService.js';

export const conditionEvaluators = {
    ANY_ALLY_DAMAGED: ({ world, entityId, params }) => {
        const { includeSelf = false } = params || {};
        const allies = TargetingService.getValidAllies(world, entityId, includeSelf);
        return TargetingService.findMostDamagedAllyPart(world, allies) !== null;
    },
};

export const ConditionEvaluatorKey = Object.keys(conditionEvaluators).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});