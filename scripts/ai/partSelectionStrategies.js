/**
 * @file AIパーツ選択戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様な攻撃パーツ選択戦略（アルゴリズム）を定義します。
 */
import { MedalPersonality } from '../common/constants.js';

/**
 * メダルの性格に基づいた攻撃パーツ決定戦略のコレクション。
 * ターゲット選択戦略と同様に「ストラテジーパターン」を採用しており、
 * AIの性格に応じたパーツ選択ロジックをカプセル化し、拡張を容易にします。
 */
export const partSelectionStrategies = {
    /**
     * [デフォルト戦略]: 最も威力の高いパーツを選択します。
     * 多くの攻撃的な性格（HUNTER, CRUSHERなど）で共通して使用される基本戦略です。
     * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
     * @param {World} context.world - ワールドオブジェクト
     * @param {number} context.entityId - AIのエンティティID
     * @param {Array} context.availableParts - 使用可能なパーツのリスト [[partKey, partObject], ...]
     * @returns {[string, object]} - 選択されたパーツのキーとオブジェクト [partKey, partObject]
     */
    POWER_FOCUS: ({ world, entityId, availableParts }) => {
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        // 威力が高い順にソート
        const sortedParts = [...availableParts].sort(([, partA], [, partB]) => partB.might - partA.might);
        return sortedParts[0];
    },

    /**
     * [JOKER / RANDOM 戦略]: 使用可能なパーツから完全にランダムで1つを選択します。
     * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
     * @param {World} context.world - ワールドオブジェクト
     * @param {number} context.entityId - AIのエンティティID
     * @param {Array} context.availableParts - 使用可能なパーツのリスト [[partKey, partObject], ...]
     * @returns {[string, object]} - 選択されたパーツのキーとオブジェクト [partKey, partObject]
     */
    RANDOM: ({ world, entityId, availableParts }) => {
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        const randomIndex = Math.floor(Math.random() * availableParts.length);
        return availableParts[randomIndex];
    },
};

/**
 * メダルの性格とパーツ選択戦略をマッピングします。
 * ここで定義されていない性格は、デフォルトの'POWER_FOCUS'戦略を使用します。
 */
export const personalityToPartSelection = {
    [MedalPersonality.JOKER]: partSelectionStrategies.RANDOM,
    [MedalPersonality.RANDOM]: partSelectionStrategies.RANDOM,
};