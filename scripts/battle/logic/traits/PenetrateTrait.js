/**
 * @file PenetrateTrait.js
 * @description 「貫通」特性のロジック。
 */
import { TraitLogic } from './TraitLogic.js';
import { PartStatus } from '../../components/parts/PartComponents.js';
import { ApplyEffect, EffectContext } from '../../components/effects/Effects.js';
import { EffectType } from '../../common/constants.js';
import { BattleQueries } from '../../queries/BattleQueries.js';
import { Parts } from '../../../components/index.js'; 

export class PenetrateTrait extends TraitLogic {
    AFTER_EFFECT_APPLIED(context) {
        const { world, effectResult, effectContext, originalEffect } = context;

        if (effectResult.type === EffectType.DAMAGE && 
            effectResult.isPartBroken && 
            effectResult.overkillDamage > 0 &&
            (originalEffect.penetrates || effectResult.isPenetration)
        ) {
            const { targetId, partKey } = effectResult;
            const targetParts = world.getComponent(targetId, Parts);
            if (!targetParts) return;

            const headStatus = world.getComponent(targetParts.head, PartStatus);
            if (headStatus && !headStatus.isBroken) {
                const nextTargetPartKey = BattleQueries.findRandomPenetrationTarget(
                    world,
                    targetId,
                    partKey
                );

                if (nextTargetPartKey) {
                    const nextEffectEntity = world.createEntity();
                    world.addComponent(nextEffectEntity, new ApplyEffect({
                        type: EffectType.DAMAGE,
                        value: effectResult.overkillDamage,
                        calculation: originalEffect.calculation,
                        penetrates: true,
                        isPenetration: true,
                        params: { isCritical: effectResult.isCritical }
                    }));
                    world.addComponent(nextEffectEntity, new EffectContext({
                        sourceId: effectContext.sourceId,
                        targetId: targetId,
                        partKey: nextTargetPartKey,
                        parentId: effectContext.parentId,
                        outcome: effectContext.outcome,
                        attackingPart: effectContext.attackingPart
                    }));
                }
            }
        }
    }
}