/**
 * @file AI戦略キー定義
 */
import { MedalPersonality } from '../../common/constants.js';

export const TargetingStrategyKey = {
    ...MedalPersonality,
    DO_NOTHING: 'DO_NOTHING',
    NEAREST_ENEMY: 'NEAREST_ENEMY',
    MOST_DAMAGED_ALLY: 'MOST_DAMAGED_ALLY',
};