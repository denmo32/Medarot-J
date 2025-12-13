/**
 * @file 攻撃タイプ定義 (TypeDefinitions)
 * AttackTypeごとのステータス補正、クリティカル率補正、速度補正などのルールを定義する。
 */
import { AttackType } from '../battle/common/constants.js';

export const TypeDefinitions = {
    [AttackType.SHOOT]: {
        // 速度補正: 充填・冷却が早い (0.75倍)
        speedMultiplier: 0.75,
    },
    [AttackType.AIMED_SHOT]: {
        // ステータス補正: 成功値に脚部安定の50%を加算
        statModifiers: [
            { targetStat: 'success', sourceStat: 'legs.stability', factor: 0.5 }
        ],
        // クリティカル率補正: +50%
        criticalBonus: 0.50,
    },
    [AttackType.STRIKE]: {
        // ステータス補正: 成功値に脚部機動の50%を加算
        statModifiers: [
            { targetStat: 'success', sourceStat: 'legs.mobility', factor: 0.5 }
        ],
        // クリティカル率補正: +25%
        criticalBonus: 0.25,
    },
    [AttackType.RECKLESS]: {
        // ステータス補正: 威力に脚部推進の50%を加算
        statModifiers: [
            { targetStat: 'might', sourceStat: 'legs.propulsion', factor: 0.5 }
        ],
    },
    [AttackType.SUPPORT]: {
        // 特になし
    },
    [AttackType.REPAIR]: {
        // 特になし
    },
    [AttackType.INTERRUPT]: {
        // 特になし
    },
    [AttackType.DEFEND]: {
        // 特になし
    },
};