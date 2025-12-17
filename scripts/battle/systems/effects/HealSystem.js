/**
 * @file HealSystem.js
 * @description 回復エフェクトを処理するシステム。
 * 失敗時にメッセージが表示されるよう修正。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { Parts } from '../../../components/index.js';
import { EffectType } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';

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

        // ターゲット不在、またはパーツ指定がない場合は失敗
        if (!targetId || !partKey) {
            this._finishEffect(entityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        const targetParts = this.world.getComponent(targetId, Parts);
        const part = targetParts ? targetParts[partKey] : null;

        // パーツが存在しない、または既に破壊されている場合は回復不可（失敗）
        if (!part || part.isBroken) {
            this._finishEffect(entityId, { type: EffectType.HEAL, value: 0 });
            return;
        }

        // 回復量計算
        const powerStat = effect.calculation?.powerStat || 'might';
        const healAmount = attackingPart[powerStat] || 0;

        const oldHp = part.hp;
        const newHp = Math.min(part.maxHp, part.hp + healAmount);
        const actualHeal = newHp - oldHp;

        // 適用
        part.hp = newHp;

        const events = [];
        if (actualHeal > 0) {
            events.push({
                type: GameEvents.HP_UPDATED,
                payload: { 
                    entityId: targetId, 
                    partKey, 
                    newHp, 
                    oldHp, 
                    maxHp: part.maxHp, 
                    change: actualHeal, 
                    isHeal: true 
                }
            });
        }

        const resultData = {
            type: EffectType.HEAL,
            targetId,
            partKey,
            value: actualHeal,
            oldHp,
            newHp,
            events
        };

        this._finishEffect(entityId, resultData);
    }

    _finishEffect(entityId, resultData) {
        this.world.removeComponent(entityId, ApplyEffect);
        this.world.addComponent(entityId, new EffectResult(resultData));
    }
}