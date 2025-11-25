/**
 * @file 数学・確率計算ユーティリティ
 * @description ゲーム全体で使用可能な汎用的な数学関数や確率計算ロジックを提供します。
 */

/**
 * 重み付けされたアイテムのリストから、確率に基づいてアイテムを1つ選択します。
 * @param {Array<object>} weightedItems - `weight`プロパティを持つオブジェクトの配列
 * @returns {object | null} 選択されたアイテム、またはnull
 */
export function selectItemByProbability(weightedItems) {
    if (!weightedItems || weightedItems.length === 0) return null;

    const totalWeight = weightedItems.reduce((sum, item) => sum + (item.weight || 0), 0);
    if (totalWeight === 0) return weightedItems[0];

    const randomValue = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (const item of weightedItems) {
        cumulativeWeight += (item.weight || 0);
        if (randomValue < cumulativeWeight) {
            return item;
        }
    }
    return weightedItems[0];
}