/**
 * @file HealHandler.js
 * @description 回復処理のロジック。
 */
import { EffectHandler } from './EffectHandler.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { Parts } from '../../../components/index.js'; // Common
import { PartStatus } from '../../components/parts/PartComponents.js';
import { EffectType } from '../../common/constants.js';
import { HpChangedEvent } from '../../../components/Events.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';

export class HealHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { targetId, partKey, attackingPart } = context;

        if (!targetId || !partKey) {
            this.finish(world, effectEntityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        const targetParts = world.getComponent(targetId, Parts);
        if (!targetParts || targetParts[partKey] === null) {
            this.finish(world, effectEntityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        const partEntityId = targetParts[partKey];
        const partStatus = world.getComponent(partEntityId, PartStatus);

        if (!partStatus || partStatus.isBroken) {
            // 破壊されたパーツは回復不可
            this.finish(world, effectEntityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        const powerStat = effect.calculation?.powerStat || 'might';
        const healAmount = attackingPart[powerStat] || 0;

        const oldHp = partStatus.hp;
        const newHp = Math.min(partStatus.maxHp, partStatus.hp + healAmount);
        const actualHeal = newHp - oldHp;

        partStatus.hp = newHp;

        if (actualHeal > 0) {
            const hpChangeEventEntity = world.createEntity();
            world.addComponent(hpChangeEventEntity, new HpChangedEvent({
                entityId: targetId,
                partKey,
                newHp,
                oldHp,
                maxHp: partStatus.maxHp,
                change: actualHeal,
                isHeal: true
            }));
        }

        const resultData = {
            type: EffectType.HEAL,
            targetId,
            partKey,
            value: actualHeal,
            oldHp,
            newHp
        };

        this.finish(world, effectEntityId, resultData);
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.HEAL];
        const messageKey = resultData.value > 0 ? def.keys.success : def.keys.failed;
        return { messageKey };
    }
}