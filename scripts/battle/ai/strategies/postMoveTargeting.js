/**
 * @file AI移動後ターゲティング戦略
 * @description 格闘攻撃など、移動後にターゲットを決定する必要があるアクション用の戦略を定義します。
 */
import { selectRandomPart, findNearestEnemy } from '../../utils/queryUtils.js';
// ★★★ 修正: 循環参照を避けるため、独立した strategyKeys.js からインポートする ★★★
import { TargetingStrategyKey } from '../strategyKeys.js';

export const postMoveStrategies = {
    /**
     * [NEAREST_ENEMY]: 自身に最も近い敵をターゲットとします。
     * 格闘や妨害など、近接攻撃に適した戦略です。
     */
    [TargetingStrategyKey.NEAREST_ENEMY]: ({ world, attackerId }) => {
        const nearestEnemyId = findNearestEnemy(world, attackerId);
        if (nearestEnemyId !== null) {
            return selectRandomPart(world, nearestEnemyId);
        }
        return null;
    },
};