/**
 * @file GuardConsumeHandler.js
 * @description ガード消費 (CONSUME_GUARD) のロジック。
 */
import { EffectHandler } from './EffectHandler.js';
import { ActiveEffects } from '../../components/index.js'; // Battle
import { EffectType } from '../../common/constants.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';

export class GuardConsumeHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { targetId, partKey } = context;

        const activeEffects = world.getComponent(targetId, ActiveEffects);
        if (!activeEffects) {
            this.finish(world, effectEntityId, { type: EffectType.CONSUME_GUARD, value: 0 });
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

            // 今回の消費で0になるなら期限切れ扱い
            if (guardEffect.count - 1 <= 0) {
                isExpired = true;
                stateUpdates.push({
                    type: 'ResetToCooldown',
                    targetId: targetId,
                    options: {}
                });
            }
        }

        this.finish(world, effectEntityId, {
            type: EffectType.CONSUME_GUARD,
            targetId,
            partKey,
            isExpired,
            value: 0,
            stateUpdates
        });
    }

    resolveVisual(resultData, visualConfig) {
        // 消費自体にはメッセージを出さず、期限切れ時のみ出す想定
        if (resultData.isExpired) {
            const def = VisualDefinitions[EffectType.CONSUME_GUARD];
            return { messageKey: def.keys.expired };
        }
        return null;
    }
}