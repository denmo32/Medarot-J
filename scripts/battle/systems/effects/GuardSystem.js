/**
 * @file GuardSystem.js
 * @description ガード状態の消費処理。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { ActiveEffects } from '../../components/index.js';
import { EffectType } from '../../common/constants.js';

export class GuardSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(ApplyEffect, EffectContext);
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, ApplyEffect);
            if (effect.type !== EffectType.CONSUME_GUARD) continue;

            this._processConsumeGuard(entityId, effect);
        }
    }

    _processConsumeGuard(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { targetId, partKey } = context;

        const activeEffects = this.world.getComponent(targetId, ActiveEffects);
        if (!activeEffects) {
            this._finishEffect(entityId, { type: EffectType.CONSUME_GUARD, value: 0 });
            return;
        }

        const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD && e.partKey === partKey);
        let isExpired = false;
        const stateUpdates = [];

        if (guardEffect) {
            stateUpdates.push({
                type: 'CustomUpdateComponent',
                targetId: targetId,
                componentType: ActiveEffects,
                customHandler: (ae) => {
                    const ge = ae.effects.find(e => e.type === EffectType.APPLY_GUARD && e.partKey === partKey);
                    if (ge) {
                        ge.count = Math.max(0, ge.count - 1);
                        if (ge.count === 0) {
                            ae.effects = ae.effects.filter(e => e !== ge);
                        }
                    }
                }
            });

            if (guardEffect.count - 1 <= 0) {
                isExpired = true;
                stateUpdates.push({
                    type: 'ResetToCooldown',
                    targetId: targetId,
                    options: {}
                });
            }
        }

        const resultData = {
            type: EffectType.CONSUME_GUARD,
            targetId,
            partKey,
            isExpired,
            value: 0,
            stateUpdates
        };

        this._finishEffect(entityId, resultData);
    }

    _finishEffect(entityId, resultData) {
        this.world.removeComponent(entityId, ApplyEffect);
        this.world.addComponent(entityId, new EffectResult(resultData));
    }
}