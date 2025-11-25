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

/**
 * 値を指定された最小値と最大値の範囲内に制限します。
 * @param {number} value - 対象の値
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {number} 範囲内に制限された値
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 2点間のユークリッド距離を計算します。
 * @param {number} x1 - 点1のX座標
 * @param {number} y1 - 点1のY座標
 * @param {number} x2 - 点2のX座標
 * @param {number} y2 - 点2のY座標
 * @returns {number} 距離
 */
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 線形補間を行います。
 * @param {number} start - 開始値
 * @param {number} end - 終了値
 * @param {number} t - 補間係数 (0.0 - 1.0)
 * @returns {number} 補間された値
 */
export function lerp(start, end, t) {
    return start + (end - start) * clamp(t, 0, 1);
}