/**
 * @file AI定義定数
 * @description AI関連の戦略キーなどの定数を一元管理します。
 * 旧 strategyKeys.js
 */
import { MedalPersonality } from '../../common/constants.js';

export const TargetingStrategyKey = {
    ...MedalPersonality,
    DO_NOTHING: 'DO_NOTHING',
    NEAREST_ENEMY: 'NEAREST_ENEMY',
    MOST_DAMAGED_ALLY: 'MOST_DAMAGED_ALLY',
};