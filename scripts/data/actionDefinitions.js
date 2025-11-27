/**
 * @file アクション定義マスターデータ
 * ゲームに登場するすべての「行動の種類」の振る舞いを一元管理します。
 */
import { TargetTiming, EffectType, EffectScope } from '../common/constants.js';
import { TargetingStrategyKey } from '../battle/ai/strategyKeys.js'; // AI戦略キーはBattle依存だが、データ定義として許容するか、あるいはキー文字列にする

export const ActionDefinitions = {
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

    RECKLESS_STRIKE: {
        actionType: 'MELEE',
        isSupport: false,
        penetrates: true,
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
        targetTiming: TargetTiming.POST_MOVE,
        targetScope: EffectScope.SELF,
        effects: [
            { type: EffectType.APPLY_GUARD, countMultiplier: 0.1, powerSource: 'might' }
        ]
    },
};

export const ActionDefinitionKey = Object.keys(ActionDefinitions).reduce((acc, key) => {
    acc[key] = key;
    return acc;
}, {});