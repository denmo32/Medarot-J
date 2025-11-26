/**
 * @file AI戦略キー定義
 * @description AIのターゲティング戦略キーを一元管理します。
 * 循環参照を避けるため、戦略の定義ファイルから分離されました。
 */
import { MedalPersonality } from './constants.js';

/**
 * AIターゲティング戦略のキーを定義する定数。
 */
export const TargetingStrategyKey = {
    ...MedalPersonality,
    DO_NOTHING: 'DO_NOTHING',
    NEAREST_ENEMY: 'NEAREST_ENEMY',
    MOST_DAMAGED_ALLY: 'MOST_DAMAGED_ALLY',
};