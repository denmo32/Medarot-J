/**
 * @file AI性格レジストリ
 * AIの「性格」と、それに対応する行動戦略（ターゲット選択、パーツ選択）の関連性を一元管理します。
 */
import { MedalPersonality } from '../common/constants.js';
import { targetingStrategies, TargetingStrategyKey } from './targetingStrategies.js';
import { partSelectionStrategies, PartSelectionStrategyKey } from './partSelectionStrategies.js';
import { ConditionEvaluatorKey } from './conditionEvaluators.js';

/**
 * AIの性格と戦略のマッピング。
 * 新しいAI性格を追加する際は、このオブジェクトに新しいエントリを追加するだけで、
 * 行動の優先順位（思考ルーチン）と代替戦略を定義できます。
 *
 * @property {object} [personality] - AIの性格ごとの戦略定義。
 * @property {Array<{partStrategy: string, targetStrategy: string, condition?: object}>} routines - AIが優先順位順に試行する思考ルーチンのリスト。
 *   - `partStrategy`: 使用するパーツを選択する戦略のキー (partSelectionStrategiesより)。
 *   - `targetStrategy`: ターゲットを選択する戦略のキー (targetingStrategiesより)。
 *   - `condition`: (任意) このルーチンを実行するための条件を評価するデータオブジェクト。
 *       - `type`: AiSystemの`conditionEvaluators`で定義された評価キー (例: 'ANY_ALLY_DAMAGED')。
 *       - `params`: (任意) 評価関数に渡すパラメータ。
 * @property {string} fallbackTargeting - `routines`の全試行が失敗した場合に実行される最終的なターゲット選択戦略のキー。
 */
export const personalityRegistry = {
    [MedalPersonality.HUNTER]: {
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、最もHPの低い敵パーツを狙う
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.HUNTER,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.CRUSHER]: {
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、最もHPの高い敵パーツを狙う
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.CRUSHER,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.JOKER]: {
        routines: [
            // 優先度1: ランダムなパーツで、敵の全パーツからランダムにターゲットを選択
            {
                partStrategy: PartSelectionStrategyKey.RANDOM,
                targetStrategy: TargetingStrategyKey.JOKER,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.COUNTER]: {
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、最後に自分を攻撃してきた敵を狙う
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.COUNTER,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.GUARD]: {
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、味方リーダーを最後に攻撃してきた敵を狙う
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.GUARD,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.FOCUS]: {
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、自分が前回攻撃したパーツを狙う
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.FOCUS,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.ASSIST]: {
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、味方が最後に攻撃した敵のパーツを狙う
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.ASSIST,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.LEADER_FOCUS]: {
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、敵チームのリーダーを狙う
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.LEADER_FOCUS,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.RANDOM]: {
        routines: [
            // 優先度1: ランダムなパーツで、ランダムな敵を狙う
            {
                partStrategy: PartSelectionStrategyKey.RANDOM,
                targetStrategy: TargetingStrategyKey.RANDOM,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
    [MedalPersonality.HEALER]: {
        routines: [
            // 優先度1: 最も効果の高い回復パーツで、最も損害の大きい味方を回復する
            {
                partStrategy: PartSelectionStrategyKey.HEAL_FOCUS,
                targetStrategy: TargetingStrategyKey.HEALER,
                condition: {
                    // 文字列リテラルを定数に置き換え
                    type: ConditionEvaluatorKey.ANY_ALLY_DAMAGED,
                    params: { includeSelf: true } // 評価関数に渡すパラメータ
                }
            },
            // 優先度2 (フォールバック): 回復対象がいない場合、最も威力の高い攻撃パーツでランダムな敵を攻撃する
            {
                partStrategy: PartSelectionStrategyKey.POWER_FOCUS,
                targetStrategy: TargetingStrategyKey.RANDOM,
            },
        ],
        // fallbackTargetingの値を関数参照から戦略キーに変更
        fallbackTargeting: TargetingStrategyKey.RANDOM,
    },
};

/**
 * 指定された性格に対応する戦略セットを取得します。
 * レジストリに存在しない性格の場合は、デフォルトとしてRANDOMの戦略を返します。
 * @param {string} personality - メダルの性格 (MedalPersonality)
 * @returns {{routines: Array<{partStrategy: string, targetStrategy: string}>, fallbackTargeting: string}}
 */
export function getStrategiesFor(personality) {
    return personalityRegistry[personality] || personalityRegistry[MedalPersonality.RANDOM];
}