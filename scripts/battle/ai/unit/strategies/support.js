/**
 * @file Unit AI: Support Strategies
 * @description TargetingServiceへの依存をQueryServiceへ変更。
 */
import { QueryService } from '../../../services/QueryService.js';
import { TargetingStrategyKey } from '../../AIDefinitions.js';

const findMostDamagedStrategy = ({ world, attackerId }) => {
    const allies = QueryService.getValidAllies(world, attackerId, true); 
    const mostDamagedTarget = QueryService.findMostDamagedAllyPart(world, allies);

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