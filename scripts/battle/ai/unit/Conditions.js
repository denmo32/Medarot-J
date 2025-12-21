/**
 * @file Unit AI: Conditions
 * @description QueryServiceの参照をBattleQueriesへ変更。
 */
import { BattleQueries } from '../../queries/BattleQueries.js';

export const conditionEvaluators = {
    // 味方の誰かがダメージを受けているか
    ANY_ALLY_DAMAGED: ({ world, entityId, params }) => {
        const { includeSelf = false } = params || {};
        const allies = BattleQueries.getValidAllies(world, entityId, includeSelf);
        return BattleQueries.findMostDamagedAllyPart(world, allies) !== null;
    },
};

export const ConditionEvaluatorKey = Object.keys(conditionEvaluators).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});