/**
 * @file アクション定義マスターデータ
 * このファイルは、ゲームに登場するすべての「行動の種類」の振る舞いを一元管理します。
 * パーツの静的なパラメータと、それが引き起こす行動の振る舞いを完全に分離することで、
 * 新しい行動の追加を容易にし、システムの変更を最小限に抑えます。
 */
import { TargetTiming, EffectType, EffectScope } from '../common/constants.js';
import { TargetingStrategyKey } from '../ai/targetingStrategies.js';

export const ActionDefinitions = {
    /**
     * @property {string} actionType - システムがロジック分岐に使うための論理的なアクション分類。
     * @property {boolean} isSupport - これが支援（非ダメージ）系のアクションかを判定するフラグ。
     * @property {boolean} [penetrates] - 攻撃がパーツを破壊した際に余剰ダメージが貫通するか。
     * @property {string} targetTiming - ターゲット決定のタイミング。
     * @property {string} [postMoveTargeting] - 移動後ターゲット決定戦略のキー。
     * @property {string} targetScope - AIがターゲット候補を選ぶ際のデフォルト範囲 (EffectScope定数)。
     * @property {Array<object>} effects - この行動が引き起こす効果のリスト。
     * @property {string} type - 効果の種類 (EffectType)。
     * @property {string} [powerSource] - 効果量の計算基準 ('might', 'success'など)。
     * @property {number} [chance] - 効果が発動する確率 (0.0 - 1.0)。
     * @property {number} [duration] - 効果の持続ターン数。
     * @property {number} [countMultiplier] - 効果回数を計算するための係数 (威力などに乗算)。
     */

    // --- 射撃系 ---
    SINGLE_SHOT: {
        actionType: 'SHOOT',
        isSupport: false,
        targetTiming: TargetTiming.PRE_MOVE,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [
            { type: EffectType.DAMAGE, powerSource: 'might' }
        ]
    },

    // --- 格闘系 ---
    MELEE_STRIKE: {
        actionType: 'MELEE',
        isSupport: false,
        targetTiming: TargetTiming.POST_MOVE,
        postMoveTargeting: TargetingStrategyKey.NEAREST_ENEMY,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [
            { type: EffectType.DAMAGE, powerSource: 'might' }
        ]
    },

    // 我武者羅攻撃用の定義。貫通属性(penetrates)を持つ。
    RECKLESS_STRIKE: {
        actionType: 'MELEE',
        isSupport: false,
        penetrates: true, // 貫通属性
        targetTiming: TargetTiming.POST_MOVE,
        postMoveTargeting: TargetingStrategyKey.NEAREST_ENEMY,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [
            { type: EffectType.DAMAGE, powerSource: 'might' }
        ]
    },

    // --- 回復系 ---
    SINGLE_HEAL: {
        actionType: 'HEAL',
        isSupport: true,
        targetTiming: TargetTiming.POST_MOVE,
        postMoveTargeting: TargetingStrategyKey.MOST_DAMAGED_ALLY,
        targetScope: EffectScope.ALLY_SINGLE,
        effects: [
            { type: EffectType.HEAL, powerSource: 'might' }
        ]
    },
    
    // --- 援護系 ---
    TEAM_SCAN: {
        actionType: 'SUPPORT',
        isSupport: true,
        targetTiming: TargetTiming.PRE_MOVE,
        targetScope: EffectScope.ALLY_TEAM,
        effects: [
            { type: EffectType.APPLY_SCAN, duration: 3, powerSource: 'might' }
        ]
    },

    // --- 妨害系 ---
    SINGLE_GLITCH: {
        actionType: 'INTERRUPT',
        isSupport: true,
        targetTiming: TargetTiming.POST_MOVE,
        postMoveTargeting: TargetingStrategyKey.NEAREST_ENEMY,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [
            { type: EffectType.APPLY_GLITCH }
        ]
    },
    
    // --- 防御系 ---
    SELF_GUARD: {
        actionType: 'DEFEND',
        isSupport: true,
        targetTiming: TargetTiming.POST_MOVE, // ターゲットは不要だが、タイミングとしては移動後
        targetScope: EffectScope.SELF,
        effects: [
            { type: EffectType.APPLY_GUARD, countMultiplier: 0.1, powerSource: 'might' }
        ]
    },
};

/**
 * 行動定義のキーを定義する定数。
 * 文字列リテラルへの依存をなくし、タイプセーフティを向上させます。
 */
export const ActionDefinitionKey = Object.keys(ActionDefinitions).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});