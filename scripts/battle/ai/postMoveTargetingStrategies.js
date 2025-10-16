/**
 * @file 移動後ターゲット決定戦略
 * このファイルは、「移動後にターゲットを決定する」タイプのアクション（格闘、回復など）が
 * どのようにターゲットを選択するかのアルゴリズムを定義します。
 */
import { findNearestEnemy, findMostDamagedAllyPart, getValidAllies, selectRandomPart } from '../utils/queryUtils.js';

/**
 * 移動後ターゲット決定戦略のコレクション。
 * 「ストラテジーパターン」を採用しており、パーツデータに設定されたキー（例: 'NEAREST_ENEMY'）に
 * 基づいて、ここから適切な関数が動的に呼び出されます。
 */
export const postMoveTargetingStrategies = {
    /**
     * [NEAREST_ENEMY]: 自身に最も近い敵をターゲットとします。
     * 格闘や妨害など、近接攻撃に適した戦略です。
     * @param {object} context - 戦略のコンテキスト
     * @param {World} context.world - ワールドオブジェクト
     * @param {number} context.attackerId - 攻撃者のエンティティID
     * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報
     */
    NEAREST_ENEMY: ({ world, attackerId }) => {
        const nearestEnemyId = findNearestEnemy(world, attackerId);
        if (nearestEnemyId !== null) {
            return selectRandomPart(world, nearestEnemyId);
        }
        return null;
    },

    /**
     * [MOST_DAMAGED_ALLY]: 味方の中で最も損害（最大HP - 現在HP）の大きいパーツをターゲットとします。
     * 回復アクションに最適な戦略です。
     * @param {object} context - 戦略のコンテキスト
     * @param {World} context.world - ワールドオブジェクト
     * @param {number} context.attackerId - 行動者のエンティティID
     * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報
     */
    MOST_DAMAGED_ALLY: ({ world, attackerId }) => {
        const allies = getValidAllies(world, attackerId, true); // 自分を含む
        return findMostDamagedAllyPart(world, allies);
    },
};

/**
 * ★新規: 移動後ターゲット決定戦略のキーを定義する定数。
 * 文字列リテラルへの依存をなくし、タイプセーフティを向上させます。
 * `parts.js`で使用されます。
 */
export const PostMoveTargetingStrategyKey = Object.keys(postMoveTargetingStrategies).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});