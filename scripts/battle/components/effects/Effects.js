/**
 * @file Effects.js
 * @description エフェクト処理システムで使用するコンポーネント定義。
 */

/**
 * エフェクト適用要求を表すコンポーネント。
 * このコンポーネントを持つエンティティは、対応するEffectSystemによって処理される。
 */
export class ApplyEffect {
    /**
     * @param {object} params
     * @param {string} params.type - EffectType (DAMAGE, HEAL, etc.)
     * @param {number} [params.value] - 基本威力や回復量
     * @param {object} [params.calculation] - 計算パラメータ (baseStat, powerStat等)
     * @param {object} [params.params] - その他のパラメータ (duration, factor等)
     * @param {boolean} [params.penetrates=false] - 貫通属性の有無
     * @param {boolean} [params.isPenetration=false] - 貫通によって発生したエフェクトか
     */
    constructor({ type, value, calculation, params, penetrates = false, isPenetration = false }) {
        this.type = type;
        this.value = value;
        this.calculation = calculation || {};
        this.params = params || {};
        this.penetrates = penetrates;
        this.isPenetration = isPenetration;
    }
}

/**
 * エフェクトのコンテキスト情報（発生源、対象、親アクション）を保持するコンポーネント。
 */
export class EffectContext {
    /**
     * @param {object} params
     * @param {number} params.sourceId - エフェクト発生源のエンティティID
     * @param {number} params.targetId - エフェクト適用先のエンティティID
     * @param {string} [params.partKey] - 適用対象パーツキー
     * @param {number} params.parentId - このエフェクトを生成した大元のアクションエンティティID
     * @param {object} [params.outcome] - 命中判定結果 (CombatCalculatorの結果)
     * @param {object} [params.attackingPart] - 攻撃に使用されたパーツデータ
     */
    constructor({ sourceId, targetId, partKey, parentId, outcome, attackingPart }) {
        this.sourceId = sourceId;
        this.targetId = targetId;
        this.partKey = partKey;
        this.parentId = parentId;
        this.outcome = outcome;
        this.attackingPart = attackingPart;
    }
}

/**
 * エフェクトの処理結果を保持するコンポーネント。
 * ApplyEffectが処理された後、ApplyEffectコンポーネントと置換される形で付与される。
 */
export class EffectResult {
    /**
     * @param {object} resultData - 処理結果データ
     * (type, value, isCritical, isGuardBroken, events, stateUpdatesなど)
     */
    constructor(resultData) {
        this.data = resultData;
        this.processedAt = Date.now();
    }
}