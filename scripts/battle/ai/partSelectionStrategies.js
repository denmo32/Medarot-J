/**
 * @file AIパーツ選択戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様な攻撃パーツ選択戦略（アルゴリズム）を定義します。
 */
import { MedalPersonality } from '../../config/constants.js';
import { PartRoleKey } from '../../data/partRoles.js';

/**
 * 指定されたフィルター関数とソート関数に基づいてパーツ選択戦略を生成する高階関数。
 * `POWER_FOCUS`や`HEAL_FOCUS`だけでなく、より複雑な条件（例: 特定のアクションタイプを持つパーツ）にも対応可能になります。
 * @param {function} filterFn - パーツをフィルタリングする関数 (例: ([, part]) => part.role.key === PartRoleKey.DAMAGE)
 * @param {function} sortFn - ソート関数 (例: (a, b) => b.might - a.might)
 * @returns {function} AIパーツ選択戦略関数
 */
const createFilteredSortStrategy = (filterFn, sortFn) => 
    /**
     * 引数のシグネチャを ({ world, entityId, availableParts }) に統一。
     * これにより、全てのパーツ選択戦略が同じインターフェースを持つことになり、一貫性が向上します。
     * この戦略では world と entityId は使用しませんが、シグネチャの統一性を優先します。
     */
    ({ world, entityId, availableParts }) => {
    if (!availableParts || availableParts.length === 0) {
        return [null, null];
    }
    // 1. 指定されたフィルター関数でパーツをフィルタリング
    const filteredParts = availableParts.filter(filterFn);
    
    // 2. 該当するパーツがなければ選択不可
    if (filteredParts.length === 0) {
        return [null, null];
    }
    
    // 3. 指定されたソート関数で並び替え、最も優先度の高いものを返す
    const sortedParts = [...filteredParts].sort(sortFn);
    return sortedParts[0];
};

/**
 * メダルの性格に基づいた攻撃パーツ決定戦略のコレクション。
 * ターゲット選択戦略と同様に「ストラテジーパターン」を採用しており、
 * AIの性格に応じたパーツ選択ロジックをカプセル化し、拡張を容易にします。
 */
export const partSelectionStrategies = {
    /**
     * [デフォルト戦略]: 攻撃パーツの中で最も威力の高いものを選択します。
     * 多くの攻撃的な性格（HUNTER, CRUSHERなど）で共通して使用される基本戦略です。
     */
    POWER_FOCUS: createFilteredSortStrategy(
        ([, part]) => part.role && part.role.key === PartRoleKey.DAMAGE, // フィルター関数
        ([, partA], [, partB]) => partB.might - partA.might // ソート関数
    ),

    /**
     * [回復優先戦略]: 回復パーツの中で最も効果の高いものを選択します。
     */
    HEAL_FOCUS: createFilteredSortStrategy(
        ([, part]) => part.role && part.role.key === PartRoleKey.HEAL, // フィルター関数
        ([, partA], [, partB]) => partB.might - partA.might // ソート関数
    ),

    /**
     * [JOKER / RANDOM 戦略]: 使用可能なパーツから完全にランダムで1つを選択します。
     * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
     * @param {World} context.world - ワールドオブジェクト
     * @param {number} context.entityId - AIのエンティティID
     * @param {Array} context.availableParts - 使用可能なパーツのリスト [[partKey, partObject], ...]
     * @returns {[string, object]} - 選択されたパーツのキーとオブジェクト [partKey, partObject]
     */
    RANDOM: ({ world, entityId, availableParts }) => {
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        const randomIndex = Math.floor(Math.random() * availableParts.length);
        return availableParts[randomIndex];
    },

    /**
     * [改善案] [汎用戦略]: 任意のフィルター関数とソート関数をパラメータとして受け取って実行します。
     * personalityRegistryから動的に呼び出されることを想定しています。
     * これにより、personalityRegistryだけで新しいAIの思考パターンを宣言的に定義できます。
     * @param {object} params - { filterFn, sortFn }
     * @returns {function} AIパーツ選択戦略関数
     */
    FLEXIBLE_STRATEGY: (params) => createFilteredSortStrategy(params.filterFn, params.sortFn),
};

/**
 * AIパーツ選択戦略のキーを定義する定数。
 * 文字列リテラルへの依存をなくし、タイプセーフティを向上させます。
 * `personalityRegistry`などで使用されます。
 */
export const PartSelectionStrategyKey = Object.keys(partSelectionStrategies).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});