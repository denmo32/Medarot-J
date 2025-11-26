/**
 * @file AI支援系ターゲティング戦略
 * @description 回復や援護など、味方を対象とする戦略を定義します。
 */
import { getValidAllies, findMostDamagedAllyPart } from '../../utils/queryUtils.js';
import { TargetingStrategyKey } from '../../../config/strategyKeys.js';

// 回復系戦略の共通ロジックを関数として定義
/**
 * 味方の中から最も損害の大きいパーツを探す共通戦略ロジック
 * @param {object} context - 戦略コンテキスト
 * @param {World} context.world - ワールドオブジェクト
 * @param {number} context.attackerId - 行動主体のエンティティID
 * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }> | null} ターゲット候補リスト
 */
const findMostDamagedStrategy = ({ world, attackerId }) => {
    const allies = getValidAllies(world, attackerId, true); // 自分を含む
    const mostDamagedTarget = findMostDamagedAllyPart(world, allies);

    // 単一のターゲットが見つかった場合、それを唯一の候補として高い重みで返す
    if (mostDamagedTarget) {
        return [{
            target: mostDamagedTarget,
            weight: 10
        }];
    }
    return null;
};

export const supportStrategies = {
    /**
     * [HEALER]: 味方を回復することに専念する、支援的な性格。
     */
    // 共通ロジックを参照
    [TargetingStrategyKey.HEALER]: findMostDamagedStrategy,
    /**
     * [MOST_DAMAGED_ALLY]: 味方の中で最も損害の大きいパーツをターゲットとします。
     * 回復アクションに最適な戦略です。
     */
    // 共通ロジックを参照
    [TargetingStrategyKey.MOST_DAMAGED_ALLY]: findMostDamagedStrategy,
};