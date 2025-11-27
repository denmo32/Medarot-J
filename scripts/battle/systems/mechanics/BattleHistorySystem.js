import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../context/index.js';
import { BattleLog, PlayerInfo } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { EffectType } from '../../common/constants.js';

export class BattleHistorySystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
    }

    onCombatSequenceResolved(detail) {
        const { attackerId, appliedEffects, attackingPart } = detail;
        
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
            this.battleContext.history.teamLastAttack[attackerInfo.teamId] = { targetId, partKey };
        }

        if (targetInfo.isLeader && !attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            this.battleContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }
}