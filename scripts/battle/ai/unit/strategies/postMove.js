/**
 * @file Unit AI: Post-Move Strategies
 * @description 移動後のターゲット選定（格闘攻撃時など）の戦略。
 * 旧 strategies/postMoveTargeting.js
 */
import { QueryService } from '../../../services/QueryService.js';
import { TargetingService } from '../../../services/TargetingService.js';
import { TargetingStrategyKey } from '../../AIDefinitions.js';
import { Position } from '../../../components/index.js';

const findNearestEnemy = (world, attackerId) => {
    const attackerPos = world.getComponent(attackerId, Position);
    if (!attackerPos) return null;
    
    const enemies = TargetingService.getValidEnemies(world, attackerId);
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
        const allies = TargetingService.getValidAllies(world, attackerId, true);
        return TargetingService.findMostDamagedAllyPart(world, allies);
    },
};