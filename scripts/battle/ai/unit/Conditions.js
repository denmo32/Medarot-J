/**
 * @file Unit AI: Conditions
 * @description 思考ルーチン（PersonalityRegistry）で使用される条件判定ロジック。
 * 旧 conditionEvaluators.js
 */
import { TargetingService } from '../../services/TargetingService.js';

export const conditionEvaluators = {
    // 味方の誰かがダメージを受けているか
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