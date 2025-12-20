/**
 * @file Unit AI: Strategy Index
 * @description 各種ターゲティング戦略を集約して公開します。
 * 旧 targetingStrategies.js
 */
import { offensiveStrategies } from './offensive.js';
import { supportStrategies } from './support.js';
import { postMoveStrategies } from './postMove.js';
export { TargetingStrategyKey } from '../../AIDefinitions.js';

export const targetingStrategies = {
    ...offensiveStrategies,
    ...supportStrategies,
    ...postMoveStrategies,
};