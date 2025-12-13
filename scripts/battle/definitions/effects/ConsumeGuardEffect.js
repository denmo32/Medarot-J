/**
 * @file ConsumeGuardEffect.js
 * @description ガード回数消費効果の定義
 * createVisualsメソッドは削除され、VisualSequenceServiceとVisualDefinitionsに責務が移譲されました。
 */
import { EffectType } from '../../common/constants.js';
import { ActiveEffects } from '../../components/index.js';

export const ConsumeGuardEffect = {
    type: EffectType.CONSUME_GUARD,

    process: () => null,

    apply: ({ world, effect }) => {
        const activeEffects = world.getComponent(effect.targetId, ActiveEffects);
        if (!activeEffects) return { ...effect, events: [], stateUpdates: [] };

        const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD && e.partKey === effect.partKey);
        let isExpired = false;
        const events = [];
        const stateUpdates = [];

        if (guardEffect) {
            stateUpdates.push({
                type: 'CUSTOM_UPDATE',
                targetId: effect.targetId,
                componentType: ActiveEffects,
                customHandler: (ae) => {
                    const ge = ae.effects.find(e => e.type === EffectType.APPLY_GUARD && e.partKey === effect.partKey);
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
                // REQUEST_RESET_TO_COOLDOWN イベントの代わりにコマンドを生成
                stateUpdates.push({
                    type: 'RESET_TO_COOLDOWN',
                    targetId: effect.targetId,
                    options: {}
                });
            }
        }

        return { ...effect, isExpired, events, stateUpdates };
    }
};