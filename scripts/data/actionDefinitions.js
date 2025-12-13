/**
 * @file アクション定義マスターデータ
 * アクションごとの効果、ターゲットルール、計算パラメータを定義する。
 */
import { TargetTiming, EffectType, EffectScope } from '../battle/common/constants.js';
import { TargetingStrategyKey } from '../battle/ai/strategyKeys.js';

export const ActionDefinitions = {
    // --- 射撃系 ---
    SINGLE_SHOT: {
        actionType: 'SHOOT',
        isSupport: false,
        targetTiming: TargetTiming.PRE_MOVE,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [
            { 
                type: EffectType.DAMAGE, 
                // ダメージ計算パラメータ
                calculation: {
                    baseStat: 'success', // 命中判定の基準
                    powerStat: 'might',  // 威力の基準
                    defenseStat: 'armor', // 防御の基準
                }
            }
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
            { 
                type: EffectType.DAMAGE, 
                calculation: {
                    baseStat: 'success',
                    powerStat: 'might',
                    defenseStat: 'armor',
                }
            }
        ]
    },

    RECKLESS_STRIKE: {
        actionType: 'MELEE',
        isSupport: false,
        penetrates: true,
        targetTiming: TargetTiming.POST_MOVE,
        postMoveTargeting: TargetingStrategyKey.NEAREST_ENEMY,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [
            { 
                type: EffectType.DAMAGE, 
                calculation: {
                    baseStat: 'success',
                    powerStat: 'might',
                    defenseStat: 'armor', // がむしゃらは防御無視などの特性をここで指定可能
                }
            }
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
            { 
                type: EffectType.HEAL, 
                // 回復計算パラメータ
                calculation: {
                    powerStat: 'might'
                }
            }
        ]
    },
    
    // --- 援護系 ---
    TEAM_SCAN: {
        actionType: 'SUPPORT',
        isSupport: true,
        targetTiming: TargetTiming.PRE_MOVE,
        targetScope: EffectScope.ALLY_TEAM,
        effects: [
            { 
                type: EffectType.APPLY_SCAN, 
                // 効果パラメータ
                params: {
                    duration: 3,
                    valueSource: 'might',
                    valueFactor: 0.1 // 威力値の10%を加算
                }
            }
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
        targetTiming: TargetTiming.POST_MOVE,
        targetScope: EffectScope.SELF,
        effects: [
            { 
                type: EffectType.APPLY_GUARD, 
                params: {
                    countSource: 'might',
                    countFactor: 0.1 // 威力値の10%を回数とする
                }
            }
        ]
    },
};

export const ActionDefinitionKey = Object.keys(ActionDefinitions).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});