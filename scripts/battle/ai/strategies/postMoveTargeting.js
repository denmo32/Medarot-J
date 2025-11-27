/**
 * @file AI移動後ターゲティング戦略
 */
import { 
    selectRandomPart, 
    findNearestEnemy, 
    getValidAllies, 
    findMostDamagedAllyPart 
} from '../../utils/queryUtils.js';
import { TargetingStrategyKey } from '../strategyKeys.js';

export const postMoveStrategies = {
    [TargetingStrategyKey.NEAREST_ENEMY]: ({ world, attackerId }) => {
        const nearestEnemyId = findNearestEnemy(world, attackerId);
        if (nearestEnemyId !== null) {
            return selectRandomPart(world, nearestEnemyId);
        }
        return null;
    },
    
    [TargetingStrategyKey.MOST_DAMAGED_ALLY]: ({ world, attackerId }) => {
        const allies = getValidAllies(world, attackerId, true);
        return findMostDamagedAllyPart(world, allies);
    },
};