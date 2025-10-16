/**
 * @file AIパーツ選択戦略定義
 * このファイルは、AIの「メダルの性格」に基づいた多様な攻撃パーツ選択戦略（アルゴリズム）を定義します。
 */
// ★修正: MedalPersonalityのインポートを維持
import { MedalPersonality } from '../common/constants.js';
// ★★★ 修正: partRoles.js へのインポートパスを正しい相対パスに修正 ★★★
import { PartRoleKey } from '../data/partRoles.js';

/**
 * ★廃止: createFocusStrategyにロジックが統合されたため不要になりました。
 */
// const filterByRole = (parts, roleCondition) => { ... };

/**
 * ★新規: 特定の役割(role)に焦点を当て、指定されたプロパティでソートする戦略を生成する高階関数。
 * POWER_FOCUSやHEAL_FOCUSなど、類似した「絞り込み→ソート→選択」ロジックを共通化します。
 * @param {string} roleKey - フィルタリングするパーツの役割キー (PartRoleKey)
 * @param {function} sortFn - ソート関数 (例: (a, b) => b.might - a.might)
 * @returns {function} AIパーツ選択戦略関数
 */
const createFocusStrategy = (roleKey, sortFn) => ({ availableParts }) => {
    if (!availableParts || availableParts.length === 0) {
        return [null, null];
    }
    // 1. 指定された役割でパーツをフィルタリング
    const roleParts = availableParts.filter(([, part]) => part.role && part.role.key === roleKey);
    
    // 2. 該当する役割のパーツがなければ選択不可
    if (roleParts.length === 0) {
        return [null, null];
    }
    
    // 3. 指定されたソート関数で並び替え、最も優先度の高いものを返す
    const sortedParts = [...roleParts].sort(sortFn);
    return sortedParts[0];
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
     * ★リファクタリング: createFocusStrategy高階関数を使用して再定義。コードが宣言的になり、意図が明確化されました。
     */
    POWER_FOCUS: createFocusStrategy(
        PartRoleKey.DAMAGE,
        ([, partA], [, partB]) => partB.might - partA.might
    ),

    /**
     * [回復優先戦略]: 回復パーツの中で最も効果の高いものを選択します。
     * ★リファクタリング: createFocusStrategy高階関数を使用して再定義。
     */
    HEAL_FOCUS: createFocusStrategy(
        PartRoleKey.HEAL,
        ([, partA], [, partB]) => partB.might - partA.might
    ),

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
 * ★新規: AIパーツ選択戦略のキーを定義する定数。
 * 文字列リテラルへの依存をなくし、タイプセーフティを向上させます。
 * `personalityRegistry`などで使用されます。
 */
export const PartSelectionStrategyKey = Object.keys(partSelectionStrategies).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});