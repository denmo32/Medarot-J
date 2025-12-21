/**
 * @file Unit AI: Post-Move Strategies
 * @description TargetingServiceへの依存をQueryServiceへ変更。
 */
import { QueryService } from '../../../services/QueryService.js';
import { TargetingStrategyKey } from '../../AIDefinitions.js';
import { Position } from '../../../components/index.js';

const findNearestEnemy = (world, attackerId) => {
    const attackerPos = world.getComponent(attackerId, Position);
    if (!attackerPos) return null;
    
    const enemies = QueryService.getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;

    const enemiesWithDistance = enemies
        .map(id => {
            const pos = world.getComponent(id, Position);
            return pos ? { id, distance: Math.abs(attackerPos.x - pos.x) } : null;
        })
        .filter(item => item !== null)
        .sort((a, b) => a.distance - b.distance);

    return enemiesWithDistance.length > 0 ? enemiesWithDistance[0].id : null;
};

export const postMoveStrategies = {
    [TargetingStrategyKey.NEAREST_ENEMY]: ({ world, attackerId }) => {
        const nearestEnemyId = findNearestEnemy(world, attackerId);
        if (nearestEnemyId !== null) {
            return QueryService.selectRandomPart(world, nearestEnemyId);
        }
        return null;
    },
    
    [TargetingStrategyKey.MOST_DAMAGED_ALLY]: ({ world, attackerId }) => {
        const allies = QueryService.getValidAllies(world, attackerId, true);
        return QueryService.findMostDamagedAllyPart(world, allies);
    },
};