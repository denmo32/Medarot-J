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
 * ターゲット選択、パーツ選択、および代替戦略を定義できます。
 *
 * @property {object} [personality] - AIの性格ごとの戦略定義。
 * @property {function} primaryTargeting - その性格の基本となるターゲット選択戦略。
 * @property {function} partSelection - 使用する攻撃パーツを選択する戦略。
 * @property {function} [fallbackPartSelection] - `partSelection`が有効なパーツを見つけられなかった場合に実行される代替パーツ選択戦略。
 * @property {function} fallbackTargeting - `primaryTargeting`が有効なターゲットを見つけられなかった場合に実行される代替戦略。
 */
export const personalityRegistry = {
    [MedalPersonality.HUNTER]: {
        primaryTargeting: targetingStrategies[MedalPersonality.HUNTER],
        partSelection: partSelectionStrategies.POWER_FOCUS,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.CRUSHER]: {
        primaryTargeting: targetingStrategies[MedalPersonality.CRUSHER],
        partSelection: partSelectionStrategies.POWER_FOCUS,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.JOKER]: {
        primaryTargeting: targetingStrategies[MedalPersonality.JOKER],
        partSelection: partSelectionStrategies.RANDOM,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.COUNTER]: {
        primaryTargeting: targetingStrategies[MedalPersonality.COUNTER],
        partSelection: partSelectionStrategies.POWER_FOCUS,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.GUARD]: {
        primaryTargeting: targetingStrategies[MedalPersonality.GUARD],
        partSelection: partSelectionStrategies.POWER_FOCUS,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.FOCUS]: {
        primaryTargeting: targetingStrategies[MedalPersonality.FOCUS],
        partSelection: partSelectionStrategies.POWER_FOCUS,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.ASSIST]: {
        primaryTargeting: targetingStrategies[MedalPersonality.ASSIST],
        partSelection: partSelectionStrategies.POWER_FOCUS,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.LEADER_FOCUS]: {
        primaryTargeting: targetingStrategies[MedalPersonality.LEADER_FOCUS],
        partSelection: partSelectionStrategies.POWER_FOCUS,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    [MedalPersonality.RANDOM]: {
        primaryTargeting: targetingStrategies[MedalPersonality.RANDOM],
        partSelection: partSelectionStrategies.RANDOM,
        fallbackTargeting: targetingStrategies.RANDOM,
    },
    // ★新規: HEALER性格の定義
    [MedalPersonality.HEALER]: {
        primaryTargeting: targetingStrategies[MedalPersonality.HEALER],
        partSelection: partSelectionStrategies.HEAL_FOCUS, // ★修正: 回復パーツを最優先で探す
        // ★新規: 回復パーツがない場合、攻撃パーツを探す戦略にフォールバック
        fallbackPartSelection: partSelectionStrategies.POWER_FOCUS,
        // ★修正: プライマリ戦略（回復対象探し）が失敗した場合、ランダムな敵を攻撃する戦略にフォールバックする
        fallbackTargeting: targetingStrategies.RANDOM,
    },
};

/**
 * 指定された性格に対応する戦略セットを取得します。
 * レジストリに存在しない性格の場合は、デフォルトとしてRANDOMの戦略を返します。
 * @param {string} personality - メダルの性格 (MedalPersonality)
 * @returns {{primaryTargeting: Function, partSelection: Function, fallbackTargeting: Function}}
 */
export function getStrategiesFor(personality) {
    return personalityRegistry[personality] || personalityRegistry[MedalPersonality.RANDOM];
}