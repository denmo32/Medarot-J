/**
 * @file 数学・確率計算ユーティリティ
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

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function lerp(start, end, t) {
    return start + (end - start) * clamp(t, 0, 1);
}