/**
 * @file AI支援系ターゲティング戦略
 */
import { getValidAllies, findMostDamagedAllyPart } from '../../utils/queryUtils.js';
import { TargetingStrategyKey } from '../strategyKeys.js';

const findMostDamagedStrategy = ({ world, attackerId }) => {
    const allies = getValidAllies(world, attackerId, true); 
    const mostDamagedTarget = findMostDamagedAllyPart(world, allies);

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