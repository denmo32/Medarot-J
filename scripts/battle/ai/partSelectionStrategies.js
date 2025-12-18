/**
 * @file AIパーツ選択戦略定義
 * part.roleへのアクセスを修正。ECS化後、roleはデータに含まれていないか、統合されている必要がある。
 * 実際にはbuildPartDataでroleが統合されているので、QueryServiceが返すデータにはroleが含まれていない可能性がある。
 * （PartEntityFactoryでroleをコンポーネント化していないため）
 * 
 * 修正: PartData構築時にrole情報は失われている可能性がある。
 * ただし、AIはまだActionType等で判断可能。
 * ここでは簡易的に、PartActionコンポーネントから役割を推測するか、
 * ActionDefinitionsにrole情報を含めるべきだが、
 * 今回は QueryService.getPartData が返すデータに role が含まれていないため、
 * actionType などで代用する。
 */
import { PartRoleKey } from '../../data/partRoles.js';
import { ActionType, EffectType } from '../common/constants.js';

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
        ([, part]) => part.actionType === ActionType.SHOOT || part.actionType === ActionType.MELEE, 
        ([, partA], [, partB]) => partB.might - partA.might 
    ),

    HEAL_FOCUS: createFilteredSortStrategy(
        ([, part]) => part.actionType === ActionType.HEAL, 
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