/**
 * @file AI支援系ターゲティング戦略
 * @description 回復や援護など、味方を対象とする戦略を定義します。
 */
import { getValidAllies, findMostDamagedAllyPart } from '../../utils/queryUtils.js';
// ★★★ 修正: 循環参照を避けるため、独立した strategyKeys.js からインポートする ★★★
import { TargetingStrategyKey } from '../strategyKeys.js';

export const supportStrategies = {
    /**
     * [HEALER]: 味方を回復することに専念する、支援的な性格。
     */
    [TargetingStrategyKey.HEALER]: ({ world, attackerId }) => {
        const candidates = getValidAllies(world, attackerId, true); // 自分も含む
        return findMostDamagedAllyPart(world, candidates);
    },
    /**
     * [MOST_DAMAGED_ALLY]: 味方の中で最も損害の大きいパーツをターゲットとします。
     * 回復アクションに最適な戦略です。
     */
    [TargetingStrategyKey.MOST_DAMAGED_ALLY]: ({ world, attackerId }) => {
        const allies = getValidAllies(world, attackerId, true); // 自分を含む
        return findMostDamagedAllyPart(world, allies);
    },
};