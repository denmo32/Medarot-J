/**
 * @file Unit AI: Support Strategies
 * @description QueryServiceの参照をBattleQueriesへ変更。
 */
import { BattleQueries } from '../../../queries/BattleQueries.js';
import { TargetingStrategyKey } from '../../AIDefinitions.js';

const findMostDamagedStrategy = ({ world, attackerId }) => {
    const allies = BattleQueries.getValidAllies(world, attackerId, true); 
    const mostDamagedTarget = BattleQueries.findMostDamagedAllyPart(world, allies);

    if (mostDamagedTarget) {
        return [{
            target: mostDamagedTarget,
            weight: 10
        }];
    }
    return null;
};

export const supportStrategies = {
    [TargetingStrategyKey.HEALER]: findMostDamagedStrategy,
    [TargetingStrategyKey.MOST_DAMAGED_ALLY]: findMostDamagedStrategy,
};