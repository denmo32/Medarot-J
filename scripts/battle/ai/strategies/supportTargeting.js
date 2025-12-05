/**
 * @file AI支援系ターゲティング戦略
 */
import { TargetingService } from '../../services/TargetingService.js';
import { TargetingStrategyKey } from '../strategyKeys.js';

const findMostDamagedStrategy = ({ world, attackerId }) => {
    const allies = TargetingService.getValidAllies(world, attackerId, true); 
    const mostDamagedTarget = TargetingService.findMostDamagedAllyPart(world, allies);

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