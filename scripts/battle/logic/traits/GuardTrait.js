/**
 * @file GuardTrait.js
 * @description 「ガード」特性のロジック。
 */
import { TraitLogic } from './TraitLogic.js';
import { PlayerInfo, Parts } from '../../../components/index.js'; 
import { ActiveEffects } from '../../components/index.js'; 
import { EffectType } from '../../common/constants.js';
import { QueryService } from '../../services/QueryService.js';

export class GuardTrait extends TraitLogic {
    ON_TARGET_RESOLVING(context) {
        const { world, originalTargetId, result } = context;
        if (!originalTargetId) return;

        if (result.guardianInfo) return;

        const targetInfo = world.getComponent(originalTargetId, PlayerInfo);
        if (!targetInfo) return;

        const potentialGuardians = [];
        const allPlayers = world.getEntitiesWith(PlayerInfo, ActiveEffects, Parts);

        for (const id of allPlayers) {
            if (id === originalTargetId) continue;

            const info = world.getComponent(id, PlayerInfo);
            if (info.teamId !== targetInfo.teamId) continue;

            const parts = world.getComponent(id, Parts);
            const headData = QueryService.getPartData(world, parts.head);
            if (!headData || headData.isBroken) continue;

            const activeEffects = world.getComponent(id, ActiveEffects);
            const guardEffect = activeEffects?.effects.find(e => e.type === EffectType.APPLY_GUARD && e.count > 0);

            if (!guardEffect) continue;

            const guardPartId = parts[guardEffect.partKey];
            const guardPartData = QueryService.getPartData(world, guardPartId);
            
            if (!guardPartData || guardPartData.isBroken) continue;

            potentialGuardians.push({
                id: id,
                partKey: guardEffect.partKey,
                partHp: guardPartData.hp,
                name: info.name,
            });
        }

        if (potentialGuardians.length > 0) {
            potentialGuardians.sort((a, b) => b.partHp - a.partHp);
            const guardian = potentialGuardians[0];

            result.finalTargetId = guardian.id;
            result.finalTargetPartKey = guardian.partKey;
            result.guardianInfo = guardian;
        }
    }
}