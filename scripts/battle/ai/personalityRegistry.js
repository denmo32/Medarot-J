/**
 * @file AI性格レジストリ
 * AIの「性格」と、それに対応する行動戦略（ターゲット選択、パーツ選択）の関連性を一元管理します。
 */
import { MedalPersonality } from '../common/constants.js';
import { TargetingStrategyKey } from './targetingStrategies.js';
import { PartSelectionStrategyKey } from './partSelectionStrategies.js';
import { ConditionEvaluatorKey } from './conditionEvaluators.js';

/**
 * AIの性格と戦略のマッピング。
 *
 * @property {object} [personality] - AIの性格ごとの戦略定義。
 * @property {Array<{strategy: string, condition?: object}>} targetRoutines - ターゲット候補を決定するために、AIが優先順位順に試行するルーチンのリスト。
 *   - `strategy`: ターゲット候補リストを生成する戦略のキー (targetingStrategiesより)。
 *   - `condition`: (任意) このルーチンを実行するための条件。
 * @property {{enemy: string, ally: string | null, self: string | null}} partStrategyMap - 決定されたターゲットの種類に応じて、使用するパーツを選択する戦略のキーを定義するマップ。
 *   - `enemy`: 敵がターゲットの場合に使用するパーツ選択戦略。
 *   - `ally`: 味方がターゲットの場合に使用するパーツ選択戦略。
 * @property {string} fallbackTargeting - `targetRoutines` の全試行が失敗した場合に実行される最終的なターゲット選択戦略のキー。
 */
export const personalityRegistry = {
    [MedalPersonality.HUNTER]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.HUNTER }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.CRUSHER]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.CRUSHER }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.SPEED]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.SPEED }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.JOKER]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.JOKER }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.RANDOM,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.COUNTER]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.COUNTER }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.GUARD]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.GUARD }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.FOCUS]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.FOCUS }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.ASSIST]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.ASSIST }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.LEADER_FOCUS]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.LEADER_FOCUS }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.RANDOM]: {
        targetRoutines: [{ strategy: TargetingStrategyKey.RANDOM }],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.RANDOM,
            ally: null,
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.HEALER]: {
        targetRoutines: [
            // 優先度1: 味方がダメージを受けていれば、最も損害の大きい味方をターゲット候補にする
            {
                strategy: TargetingStrategyKey.HEALER,
                condition: {
                    type: ConditionEvaluatorKey.ANY_ALLY_DAMAGED,
                    params: { includeSelf: true }
                }
            },
            // 優先度2 (フォールバック): 回復対象がいない場合、ランダムな敵をターゲット候補にする
            {
                strategy: TargetingStrategyKey.RANDOM,
            },
        ],
        partStrategyMap: {
            enemy: PartSelectionStrategyKey.POWER_FOCUS, // 敵がターゲットなら攻撃パーツ
            ally: PartSelectionStrategyKey.HEAL_FOCUS,    // 味方がターゲットなら回復パーツ
        },
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
};

/**
 * 指定された性格に対応する戦略セットを取得します。
 * レジストリに存在しない性格の場合は、デフォルトとしてRANDOMの戦略を返します。
 * @param {string} personality - メダルの性格 (MedalPersonality)
 * @returns {{targetRoutines: Array, partStrategyMap: object, fallbackTargeting: string}}
 */
export function getStrategiesFor(personality) {
    return personalityRegistry[personality] || personalityRegistry[MedalPersonality.RANDOM];
}