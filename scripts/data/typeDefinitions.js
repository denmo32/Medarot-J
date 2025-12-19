/**
 * @file 攻撃タイプ定義 (TypeDefinitions)
 * @description 各AttackType（撃つ、殴る等）がどのような振る舞い（Action）をし、
 * AIからどう扱われるか（Role）を一括定義します。
 */
import { AttackType } from '../battle/common/constants.js';
import { ActionDefinitionKey } from './actionDefinitions.js';
import { PartRoleKey } from './partRoles.js';

export const TypeDefinitions = {
    [AttackType.撃つ]: {
        actionLabel: '射撃',
        actionKey: ActionDefinitionKey.SINGLE_SHOT,
        roleKey: PartRoleKey.DAMAGE,
        // 速度補正: 充填・冷却が早い (0.75倍)
        speedMultiplier: 0.75,
    },
    [AttackType.狙い撃ち]: {
        actionLabel: '射撃',
        actionKey: ActionDefinitionKey.SINGLE_SHOT,
        roleKey: PartRoleKey.DAMAGE,
        // ステータス補正: 成功値に脚部安定の50%を加算
        statModifiers: [
            { targetStat: 'success', sourceStat: 'legs.stability', factor: 0.5 }
        ],
        // クリティカル率補正: +50%
        criticalBonus: 0.50,
    },
    [AttackType.殴る]: {
        actionLabel: '格闘',
        actionKey: ActionDefinitionKey.MELEE_STRIKE,
        roleKey: PartRoleKey.DAMAGE,
        // ステータス補正: 成功値に脚部機動の50%を加算
        statModifiers: [
            { targetStat: 'success', sourceStat: 'legs.mobility', factor: 0.5 }
        ],
        // クリティカル率補正: +25%
        criticalBonus: 0.25,
    },
    [AttackType.我武者羅]: {
        actionLabel: '格闘',
        actionKey: ActionDefinitionKey.RECKLESS_STRIKE,
        roleKey: PartRoleKey.DAMAGE,
        // ステータス補正: 威力に脚部推進の50%を加算
        statModifiers: [
            { targetStat: 'might', sourceStat: 'legs.propulsion', factor: 0.5 }
        ],
    },
    [AttackType.支援]: {
        actionLabel: '介入',
        actionKey: ActionDefinitionKey.TEAM_SCAN,
        roleKey: PartRoleKey.SUPPORT_SCAN,
    },
    [AttackType.修復]: {
        actionLabel: '回復',
        actionKey: ActionDefinitionKey.SINGLE_HEAL,
        roleKey: PartRoleKey.HEAL,
    },
    [AttackType.妨害]: {
        actionLabel: '介入',
        actionKey: ActionDefinitionKey.SINGLE_GLITCH,
        roleKey: PartRoleKey.SUPPORT_GLITCH,
    },
    [AttackType.守る]: {
        actionLabel: '防御',
        actionKey: ActionDefinitionKey.SELF_GUARD,
        roleKey: PartRoleKey.DEFENSE,
    },
};