/**
 * @file AIパーツ選択戦略定義
 */
import { PartRoleKey } from '../../data/partRoles.js';

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
    POWER_FOCUS: createFilteredSortStrategy(
        ([, part]) => part.role && part.role.key === PartRoleKey.DAMAGE, 
        ([, partA], [, partB]) => partB.might - partA.might 
    ),

    HEAL_FOCUS: createFilteredSortStrategy(
        ([, part]) => part.role && part.role.key === PartRoleKey.HEAL, 
        ([, partA], [, partB]) => partB.might - partA.might 
    ),

    RANDOM: ({ world, entityId, availableParts }) => {
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        const randomIndex = Math.floor(Math.random() * availableParts.length);
        return availableParts[randomIndex];
    },

    FLEXIBLE_STRATEGY: (params) => createFilteredSortStrategy(params.filterFn, params.sortFn),
};

export const PartSelectionStrategyKey = Object.keys(partSelectionStrategies).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});