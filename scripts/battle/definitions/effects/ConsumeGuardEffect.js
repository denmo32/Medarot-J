/**
 * @file ConsumeGuardEffect.js
 * @description ガード回数消費効果の定義
 * Phase 2: データ駆動化
 */
import { EffectType } from '../../../common/constants.js';
import { PlayerInfo } from '../../../components/index.js';
import { ActiveEffects } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { createDialogTask } from '../../tasks/BattleTasks.js';
import { ModalType } from '../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';

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
                events.push({
                    type: GameEvents.REQUEST_RESET_TO_COOLDOWN,
                    payload: { entityId: effect.targetId, options: {} }
                });
            }
        }

        return { ...effect, isExpired, events, stateUpdates };
    },

    createTasks: ({ world, effects, messageGenerator }) => {
        const tasks = [];
        for (const effect of effects) {
            if (effect.isExpired) {
                const actorInfo = world.getComponent(effect.targetId, PlayerInfo);
                const message = messageGenerator.format(MessageKey.GUARD_EXPIRED, { 
                    actorName: actorInfo?.name || '???' 
                });
                tasks.push(createDialogTask(message, { modalType: ModalType.MESSAGE }));
            }
        }
        return tasks;
    }
};