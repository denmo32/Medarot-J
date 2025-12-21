/**
 * @file Unit AI: Conditions
 * @description TargetingServiceへの依存をQueryServiceへ変更。
 */
import { QueryService } from '../../services/QueryService.js';

export const conditionEvaluators = {
    // 味方の誰かがダメージを受けているか
    ANY_ALLY_DAMAGED: ({ world, entityId, params }) => {
        const { includeSelf = false } = params || {};
        const allies = QueryService.getValidAllies(world, entityId, includeSelf);
        return QueryService.findMostDamagedAllyPart(world, allies) !== null;
    },
};

export const ConditionEvaluatorKey = Object.keys(conditionEvaluators).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});