/**
 * @file GuardEffect.js
 * @description ガード効果の定義
 */
import { EffectType } from '../../../common/constants.js';
import { ActiveEffects } from '../../components/index.js';
import { PlayerStateType, ModalType } from '../../common/constants.js';
import { PlayerStatusService } from '../../services/PlayerStatusService.js';
import { createDialogTask } from '../../tasks/BattleTasks.js';
import { MessageKey } from '../../../data/messageRepository.js';

export const GuardEffect = {
    type: EffectType.APPLY_GUARD,

    // 計算フェーズ
    process: ({ world, sourceId, effect, part, partKey }) => {
        const params = effect.params || {};
        const countSource = params.countSource || 'might';
        const countFactor = params.countFactor || 0.1;
        
        const baseValue = part[countSource] || 0;
        const guardCount = Math.floor(baseValue * countFactor);
        
        return {
            type: EffectType.APPLY_GUARD,
            targetId: sourceId,
            value: guardCount,
            partKey: partKey,
        };
    },

    // 適用フェーズ
    apply: ({ world, effect }) => {
        // ガード状態への遷移
        PlayerStatusService.transitionTo(world, effect.targetId, PlayerStateType.GUARDING);

        // ActiveEffectsコンポーネントの更新
        const activeEffects = world.getComponent(effect.targetId, ActiveEffects);
        if (activeEffects) {
            // 既存のガード効果があれば削除
            activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            
            activeEffects.effects.push({
                type: EffectType.APPLY_GUARD,
                value: effect.value,
                count: effect.value, // ガード回数
                partKey: effect.partKey,
                duration: Infinity // ターン経過ではなく回数消費で消える
            });
        }

        return { ...effect, events: [] };
    },

    // 演出フェーズ
    createTasks: ({ world, effects, messageGenerator }) => {
        const tasks = [];
        for (const effect of effects) {
            const message = messageGenerator.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
            tasks.push(createDialogTask(message, { modalType: ModalType.EXECUTION_RESULT }));
        }
        return tasks;
    }
};