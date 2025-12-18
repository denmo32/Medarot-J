/**
 * @file HealSystem.js
 * @description 回復エフェクト処理システム。
 * パーツIDベースの処理へ修正。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { Parts } from '../../../components/index.js';
import { PartStatus } from '../../components/parts/PartComponents.js';
import { EffectType } from '../../common/constants.js';
import { HpChangedEvent } from '../../../components/Events.js';

export class HealSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(ApplyEffect, EffectContext);
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, ApplyEffect);
            if (effect.type !== EffectType.HEAL) continue;

            this._processHeal(entityId, effect);
        }
    }

    _processHeal(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { targetId, partKey, attackingPart } = context;

        if (!targetId || !partKey) {
            this._finishEffect(entityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        const targetParts = this.world.getComponent(targetId, Parts);
        if (!targetParts || targetParts[partKey] === null) {
            this._finishEffect(entityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        // パーツIDからStatus取得
        const partEntityId = targetParts[partKey];
        const partStatus = this.world.getComponent(partEntityId, PartStatus);

        if (!partStatus || partStatus.isBroken) {
            this._finishEffect(entityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        const powerStat = effect.calculation?.powerStat || 'might';
        const healAmount = attackingPart[powerStat] || 0;

        const oldHp = partStatus.hp;
        const newHp = Math.min(partStatus.maxHp, partStatus.hp + healAmount);
        const actualHeal = newHp - oldHp;

        partStatus.hp = newHp;

        if (actualHeal > 0) {
            const hpChangeEventEntity = this.world.createEntity();
            this.world.addComponent(hpChangeEventEntity, new HpChangedEvent({
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

        this._finishEffect(entityId, resultData);
    }

    _finishEffect(entityId, resultData) {
        this.world.removeComponent(entityId, ApplyEffect);
        this.world.addComponent(entityId, new EffectResult(resultData));
    }
}