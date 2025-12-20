/**
 * @file Unit AI: PersonalityRegistry
 * @description メダルの性格ごとの思考ルーチン定義。
 * Unit AI（ターゲット選択）とCommander AI（パーツ選択）の方針を紐付けます。
 * 旧 personalityRegistry.js
 */
import { MedalPersonality } from '../../../common/constants.js';
import { TargetingStrategyKey } from '../AIDefinitions.js';
import { PartSelectionStrategyKey } from '../commander/PartStrategies.js';
import { ConditionEvaluatorKey } from './Conditions.js';

const basePersonality = {
    // ターゲット決定後のパーツ選択方針 (Commander AIへの指示)
    partStrategyMap: {
        enemy: PartSelectionStrategyKey.POWER_FOCUS,
        ally: null,
    },
    // ルーチンに合致しなかった場合のターゲット選択フォールバック
    fallbackTargeting: TargetingStrategyKey.RANDOM,
};

export const personalityRegistry = {
    [MedalPersonality.HUNTER]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.HUNTER }],
    },
    [MedalPersonality.CRUSHER]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.CRUSHER }],
    },
    [MedalPersonality.SPEED]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.SPEED }],
    },
    [MedalPersonality.JOKER]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.JOKER }],
        partStrategyMap: {
            ...basePersonality.partStrategyMap,
            enemy: PartSelectionStrategyKey.RANDOM,
        },
    },
    [MedalPersonality.COUNTER]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.COUNTER }],
    },
    [MedalPersonality.GUARD]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.GUARD }],
    },
    [MedalPersonality.FOCUS]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.FOCUS }],
    },
    [MedalPersonality.ASSIST]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.ASSIST }],
    },
    [MedalPersonality.LEADER_FOCUS]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.LEADER_FOCUS }],
    },
    [MedalPersonality.RANDOM]: {
        ...basePersonality,
        targetRoutines: [{ strategy: TargetingStrategyKey.RANDOM }],
        partStrategyMap: {
            ...basePersonality.partStrategyMap,
            enemy: PartSelectionStrategyKey.RANDOM,
        },
    },
    [MedalPersonality.HEALER]: {
        ...basePersonality,
        targetRoutines: [
            {
                strategy: TargetingStrategyKey.HEALER,
                condition: {
                    type: ConditionEvaluatorKey.ANY_ALLY_DAMAGED,
                    params: { includeSelf: true }
                }
            },
            {
                strategy: TargetingStrategyKey.RANDOM,
            },
        ],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: PartSelectionStrategyKey.HEAL_FOCUS,
        },
    },
};

export function getStrategiesFor(personality) {
    return personalityRegistry[personality] || personalityRegistry[MedalPersonality.RANDOM];
}