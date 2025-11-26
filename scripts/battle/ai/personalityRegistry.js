/**
 * @file AI性格レジストリ
 * AIの「性格」と、それに対応する行動戦略（ターゲット選択、パーツ選択）の関連性を一元管理します。
 */
import { MedalPersonality } from '../../config/constants.js';
import { TargetingStrategyKey } from './targetingStrategies.js';
import { PartSelectionStrategyKey } from './partSelectionStrategies.js';
import { ConditionEvaluatorKey } from './conditionEvaluators.js';

/**
 * 多くの性格で共通する基本的な戦略設定。
 */
const basePersonality = {
    partStrategyMap: {
        enemy: PartSelectionStrategyKey.POWER_FOCUS,
        ally: null,
    },
    fallbackTargeting: TargetingStrategyKey.RANDOM,
};

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