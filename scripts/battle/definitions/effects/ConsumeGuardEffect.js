/**
 * @file ConsumeGuardEffect.js
 * @description ガード回数消費効果の定義
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

    // 計算フェーズ（消費自体はResolver内で動的に生成されるため、processは基本使用しないが互換性のため定義）
    process: () => null,

    // 適用フェーズ
    apply: ({ world, effect }) => {
        const activeEffects = world.getComponent(effect.targetId, ActiveEffects);
        const events = [];

        if (!activeEffects) return { ...effect, events };

        const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD && e.partKey === effect.partKey);
        let isExpired = false;
        
        if (guardEffect) {
            guardEffect.count = Math.max(0, guardEffect.count - 1);
            if (guardEffect.count === 0) {
                // 回数切れで削除
                activeEffects.effects = activeEffects.effects.filter(e => e !== guardEffect);
                isExpired = true;
                
                // クールダウンへ戻すリクエストのみイベントとして発行
                events.push({
                    type: GameEvents.REQUEST_RESET_TO_COOLDOWN,
                    payload: { entityId: effect.targetId, options: {} }
                });
            }
        }

        return { ...effect, isExpired, events };
    },

    // 演出フェーズ
    createTasks: ({ world, effects, messageGenerator }) => {
        const tasks = [];
        // 消費自体の演出はなく、期限切れ（isExpired）の場合のみメッセージを表示
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