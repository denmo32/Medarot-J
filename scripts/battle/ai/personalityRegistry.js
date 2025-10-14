/**
 * @file AI性格レジストリ
 * AIの「性格」と、それに対応する行動戦略（ターゲット選択、パーツ選択）の関連性を一元管理します。
 */
import { MedalPersonality } from '../common/constants.js';
import { targetingStrategies } from './targetingStrategies.js';
import { partSelectionStrategies } from './partSelectionStrategies.js';

/**
 * AIの性格と戦略のマッピング。
 * 新しいAI性格を追加する際は、このオブジェクトに新しいエントリを追加するだけで、
 * 行動の優先順位（思考ルーチン）と代替戦略を定義できます。
 *
 * @property {object} [personality] - AIの性格ごとの戦略定義。
 * @property {Array<{partStrategy: string, targetStrategy: string}>} routines - AIが優先順位順に試行する思考ルーチンのリスト。
 *   - `partStrategy`: 使用するパーツを選択する戦略のキー (partSelectionStrategiesより)。
 *   - `targetStrategy`: ターゲットを選択する戦略のキー (targetingStrategiesより)。
 * @property {function} fallbackTargeting - `routines`の全試行が失敗した場合に実行される最終的なターゲット選択戦略。
 */
export const personalityRegistry = {
    [MedalPersonality.HUNTER]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、最もHPの低い敵パーツを狙う
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.HUNTER },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.CRUSHER]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、最もHPの高い敵パーツを狙う
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.CRUSHER },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.JOKER]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: ランダムなパーツで、敵の全パーツからランダムにターゲットを選択
            { partStrategy: 'RANDOM', targetStrategy: MedalPersonality.JOKER },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.COUNTER]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、最後に自分を攻撃してきた敵を狙う
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.COUNTER },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.GUARD]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、味方リーダーを最後に攻撃してきた敵を狙う
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.GUARD },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.FOCUS]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、自分が前回攻撃したパーツを狙う
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.FOCUS },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.ASSIST]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、味方が最後に攻撃した敵のパーツを狙う
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.ASSIST },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.LEADER_FOCUS]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も威力の高い攻撃パーツで、敵チームのリーダーを狙う
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.LEADER_FOCUS },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.RANDOM]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: ランダムなパーツで、ランダムな敵を狙う
            { partStrategy: 'RANDOM', targetStrategy: MedalPersonality.RANDOM },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    // ★新規: HEALER性格の定義 (リファクタリング後)
    [MedalPersonality.HEALER]: {
        // ★リファクタリング: 宣言的な思考ルーチンリストに変更
        routines: [
            // 優先度1: 最も効果の高い回復パーツで、最も損害の大きい味方を回復する
            { partStrategy: 'HEAL_FOCUS', targetStrategy: MedalPersonality.HEALER },
            // 優先度2 (フォールバック): 回復対象がいない場合、最も威力の高い攻撃パーツでランダムな敵を攻撃する
            { partStrategy: 'POWER_FOCUS', targetStrategy: MedalPersonality.RANDOM },
        ],
        fallbackTargeting: targetingStrategies.RANDOM,
    },
};

/**
 * 指定された性格に対応する戦略セットを取得します。
 * レジストリに存在しない性格の場合は、デフォルトとしてRANDOMの戦略を返します。
 * @param {string} personality - メダルの性格 (MedalPersonality)
 * @returns {{routines: Array<{partStrategy: string, targetStrategy: string}>, fallbackTargeting: Function}}
 */
export function getStrategiesFor(personality) {
    return personalityRegistry[personality] || personalityRegistry[MedalPersonality.RANDOM];
}