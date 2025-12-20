/**
 * @file BattleHistorySystem.js
 * @description 戦闘履歴記録。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleHistoryContext } from '../../components/BattleHistoryContext.js';
import { BattleLog, CombatResult } from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';
import { EffectType } from '../../common/constants.js';

export class BattleHistorySystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(CombatResult);
        
        for (const entityId of entities) {
            const result = this.world.getComponent(entityId, CombatResult);
            if (!result || !result.data) continue;

            this._recordHistory(result.data);
        }
    }

    _recordHistory(detail) {
        const battleHistoryContext = this.world.getSingletonComponent(BattleHistoryContext);
        const { attackerId, appliedEffects, attackingPart } = detail;

        if (!appliedEffects || appliedEffects.length === 0) return;

        const mainEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE || e.type === EffectType.HEAL);
        if (!mainEffect) return;

        const { targetId, partKey } = mainEffect;
        if (targetId === null || targetId === undefined) return;

        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        if (attackerLog) {
            attackerLog.lastAttack = { targetId, partKey };
        }

        if (mainEffect.type === EffectType.DAMAGE) {
            const targetLog = this.world.getComponent(targetId, BattleLog);
            if (targetLog) {
                targetLog.lastAttackedBy = attackerId;
            }
        }

        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);

        if (!attackerInfo || !targetInfo) return;

        if (!attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            battleHistoryContext.history.teamLastAttack[attackerInfo.teamId] = { targetId, partKey };
        }

        if (targetInfo.isLeader && !attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            battleHistoryContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }
}