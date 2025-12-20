/**
 * @file Commander AI: PartStrategies
 * @description 「どのパーツを使うか」を決定するための評価ロジック集。
 * 旧 partSelectionStrategies.js
 */
import { ActionType } from '../../common/constants.js';

const createFilteredSortStrategy = (filterFn, sortFn) => 
    ({ world, entityId, availableParts }) => {
    if (!availableParts || availableParts.length === 0) {
        return [null, null];
    }
    const filteredParts = availableParts.filter(filterFn);
    
    if (filteredParts.length === 0) {
        return [null, null];
    }
    
    const sortedParts = [...filteredParts].sort(sortFn);
    return sortedParts[0];
};

export const partSelectionStrategies = {
    // 攻撃パーツ優先、威力高い順
    POWER_FOCUS: createFilteredSortStrategy(
        ([, part]) => part.actionType === ActionType.SHOOT || part.actionType === ActionType.MELEE, 
        ([, partA], [, partB]) => partB.might - partA.might 
    ),

    // 回復パーツ優先、威力高い順
    HEAL_FOCUS: createFilteredSortStrategy(
        ([, part]) => part.actionType === ActionType.HEAL, 
        ([, partA], [, partB]) => partB.might - partA.might 
    ),

    // ランダム
    RANDOM: ({ world, entityId, availableParts }) => {
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        const randomIndex = Math.floor(Math.random() * availableParts.length);
        return availableParts[randomIndex];
    },

    // 柔軟な戦略定義用
    FLEXIBLE_STRATEGY: (params) => createFilteredSortStrategy(params.filterFn, params.sortFn),
};

export const PartSelectionStrategyKey = Object.keys(partSelectionStrategies).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});