/**
 * @file アクション定義マスターデータ
 * アクションごとの効果、ターゲットルール、計算パラメータを定義する。
 */
import { TargetTiming, EffectType, EffectScope } from '../battle/common/constants.js';
import { TargetingStrategyKey } from '../battle/ai/AIDefinitions.js';

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
                calculation: {
                    baseStat: 'success',
                    powerStat: 'might',
                    defenseStat: 'armor',
                }
            }
        ],
        visuals: {
            declaration: { messageKey: 'ATTACK_DECLARATION', animation: 'attack' },
            effects: {
                [EffectType.DAMAGE]: { messageKey: 'DAMAGE_APPLIED', showHpBar: true }
            }
        }
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
        ],
        visuals: {
            declaration: { messageKey: 'ATTACK_DECLARATION', animation: 'attack' },
            effects: {
                [EffectType.DAMAGE]: { messageKey: 'DAMAGE_APPLIED', showHpBar: true }
            }
        }
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
                    defenseStat: 'armor',
                }
            }
        ],
        visuals: {
            declaration: { messageKey: 'ATTACK_DECLARATION', animation: 'attack' },
            effects: {
                [EffectType.DAMAGE]: { messageKey: 'DAMAGE_APPLIED', showHpBar: true }
            }
        }
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
                calculation: {
                    powerStat: 'might'
                }
            }
        ],
        visuals: {
            declaration: { messageKey: 'SUPPORT_DECLARATION', animation: 'support' },
            effects: {
                [EffectType.HEAL]: { messageKey: 'HEAL_SUCCESS', showHpBar: true }
            }
        }
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
                params: {
                    statName: 'success',        // 上昇させるステータス
                    valueSource: 'might',       // バフ値計算の参照
                    valueFactor: 0.5,           // 係数
                    durationSource: 'success',  // 持続時間計算の参照
                    durationFactor: 200         // 持続時間係数 (ms)
                }
            }
        ],
        visuals: {
            declaration: { messageKey: 'SUPPORT_DECLARATION', animation: 'support' },
            effects: {
                [EffectType.APPLY_SCAN]: { messageKey: 'SUPPORT_SCAN_SUCCESS' }
            }
        }
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
        ],
        visuals: {
            declaration: { messageKey: 'SUPPORT_DECLARATION', animation: 'support' },
            effects: {
                [EffectType.APPLY_GLITCH]: { messageKey: 'INTERRUPT_GLITCH_SUCCESS' }
            }
        }
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
                    countFactor: 0.1
                }
            }
        ],
        visuals: {
            declaration: { messageKey: 'SUPPORT_DECLARATION', animation: 'support' },
            effects: {
                [EffectType.APPLY_GUARD]: { messageKey: 'DEFEND_GUARD_SUCCESS' }
            }
        }
    },
};

export const ActionDefinitionKey = Object.keys(ActionDefinitions).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});