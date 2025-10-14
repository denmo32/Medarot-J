/**
 * @file AIパーツ選択戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様な攻撃パーツ選択戦略（アルゴリズム）を定義します。
 */
import { MedalPersonality } from '../common/constants.js';

/**
 * 渡されたパーツリストを指定された役割(role)でフィルタリングし、存在すればそのリストを、
 * 存在しなければ元のリストを返すヘルパー関数。
 * @param {Array} parts - パーツのリスト [[partKey, partObject], ...]
 * @param {string | Function} roleCondition - フィルタリング条件 (文字列または評価関数)
 * @returns {Array} フィルタリングされたパーツリスト
 */
const filterByRole = (parts, roleCondition) => {
    // ★リファクタリング: part.roleがオブジェクトであることを前提とし、そのkeyプロパティを比較する
    const predicate = typeof roleCondition === 'function'
        ? ([, part]) => part.role && roleCondition(part.role.key)
        : ([, part]) => part.role && part.role.key === roleCondition;

    const filtered = parts.filter(predicate);
    return filtered.length > 0 ? filtered : parts;
};

/**
 * メダルの性格に基づいた攻撃パーツ決定戦略のコレクション。
 * ターゲット選択戦略と同様に「ストラテジーパターン」を採用しており、
 * AIの性格に応じたパーツ選択ロジックをカプセル化し、拡張を容易にします。
 */
export const partSelectionStrategies = {
    /**
     * [デフォルト戦略]: 攻撃パーツの中で最も威力の高いものを選択します。
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
        // ★修正: 'damage'という文字列は role.key と比較される
        const damageParts = filterByRole(availableParts, 'damage');
        // 威力が高い順にソート
        const sortedParts = [...damageParts].sort(([, partA], [, partB]) => partB.might - partA.might);
        return sortedParts[0];
    },

    /**
     * ★新規: [回復優先戦略]: 回復パーツの中で最も効果の高いものを選択します。
     * @param {object} context - 戦略のコンテキスト
     * @returns {[string, object]} 選択されたパーツ
     */
    HEAL_FOCUS: ({ availableParts }) => {
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        // ★リファクタリング: part.roleがオブジェクトであることを前提とし、そのkeyプロパティを比較する
        const healParts = availableParts.filter(([, part]) => part.role && part.role.key === 'heal');
        if (healParts.length === 0) {
            return [null, null]; // 回復パーツがなければ選択不可
        }
        // 回復量(might)が高い順にソート
        const sortedParts = [...healParts].sort(([, partA], [, partB]) => partB.might - partA.might);
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