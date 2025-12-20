/**
 * @file Unit AI: Support Strategies
 * @description 支援・回復行動時のターゲット選定戦略。
 * 旧 strategies/supportTargeting.js
 */
import { TargetingService } from '../../../services/TargetingService.js';
import { TargetingStrategyKey } from '../../AIDefinitions.js';

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