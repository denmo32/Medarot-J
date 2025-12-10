/**
 * @file GuardEffect.js
 * @description ガード効果の定義
 * 副作用排除版。
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

    // 適用データ生成フェーズ
    apply: ({ world, effect }) => {
        // PlayerStatusService.transitionTo は副作用を持つため、ここでは呼び出さず
        // stateUpdates としてカプセル化する。
        // ただし transitionTo はコンポーネント更新以外の処理（スナップなど）も含むため
        // 単純な関数ラップでは難しい。
        // ここでは「ガード状態遷移イベント」のようなものを発行するか、
        // 特別に updateFn 内で service を呼ぶことを許容するかだが、
        // 副作用の遅延実行という意味で updateFn に含める。
        
        const stateUpdates = [];

        stateUpdates.push({
            targetId: effect.targetId,
            // どのコンポーネントに対する更新か特定しにくい（複合的）ため
            // 汎用アップデートとして扱うか、ActiveEffectsに対する更新として登録し
            // その中で副作用(transitionTo)を実行する。
            componentType: ActiveEffects,
            updateFn: (activeEffects) => {
                // ガード状態への遷移 (Service呼び出しを含む副作用)
                // ※ ここでWorldを触るのはルール違反だが、遅延実行されるため
                //   計算フェーズでの副作用は回避できている。
                PlayerStatusService.transitionTo(world, effect.targetId, PlayerStateType.GUARDING);

                // エフェクト更新
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                activeEffects.effects.push({
                    type: EffectType.APPLY_GUARD,
                    value: effect.value,
                    count: effect.value,
                    partKey: effect.partKey,
                    duration: Infinity
                });
            }
        });

        return { ...effect, events: [], stateUpdates };
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