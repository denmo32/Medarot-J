/**
 * @file AI移動後ターゲティング戦略
 * @description 格闘攻撃など、移動後にターゲットを決定する必要があるアクション用の戦略を定義します。
 */
import { 
    selectRandomPart, 
    findNearestEnemy, 
    getValidAllies, 
    findMostDamagedAllyPart 
} from '../../utils/queryUtils.js';
// 循環参照を避けるため、独立した strategyKeys.js からインポートする
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
    
    /**
     * [MOST_DAMAGED_ALLY]: 味方の中で最も損害の大きいパーツをターゲットとします。
     * 回復アクションに最適な、移動後専用の戦略です。
     * 行動実行直前に最適な回復対象を検索します。
     */
    [TargetingStrategyKey.MOST_DAMAGED_ALLY]: ({ world, attackerId }) => {
        // 自分自身を含めた味方全員を候補にする
        const allies = getValidAllies(world, attackerId, true);
        // 最も損害の大きいパーツを検索して返す
        return findMostDamagedAllyPart(world, allies);
    },
};