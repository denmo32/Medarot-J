/**
 * @file ScanEffect.js
 * @description スキャン効果の定義
 * 副作用排除版。
 */
import { EffectType, EffectScope } from '../../../common/constants.js';
import { PlayerInfo } from '../../../components/index.js';
import { ActiveEffects } from '../../components/index.js';
import { TargetingService } from '../../services/TargetingService.js';
import { createDialogTask } from '../../tasks/BattleTasks.js';
import { ModalType } from '../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';

export const ScanEffect = {
    type: EffectType.APPLY_SCAN,

    // 計算フェーズ
    process: ({ world, sourceId, effect, part }) => {
        const sourceInfo = world.getComponent(sourceId, PlayerInfo);
        if (!sourceInfo) return null;

        const params = effect.params || {};
        const valueSource = params.valueSource || 'might';
        const valueFactor = params.valueFactor || 0.1;
        const duration = params.duration || 3;

        const baseValue = part[valueSource] || 0;
        const scanBonusValue = Math.floor(baseValue * valueFactor);

        return {
            type: EffectType.APPLY_SCAN,
            scope: EffectScope.ALLY_TEAM, 
            targetId: sourceId,
            value: scanBonusValue,
            duration: duration,
        };
    },

    // 適用データ生成フェーズ
    apply: ({ world, effect }) => {
        if (!effect.scope?.endsWith('_TEAM')) return { ...effect, events: [], stateUpdates: [] };
        
        const allies = TargetingService.getValidAllies(world, effect.targetId, true);
        const stateUpdates = [];

        allies.forEach(targetId => {
            stateUpdates.push({
                targetId,
                componentType: ActiveEffects,
                updateFn: (activeEffects) => {
                    // 重複排除して追加
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== effect.type);
                    activeEffects.effects.push({
                        type: effect.type,
                        value: effect.value,
                        duration: effect.duration,
                        partKey: effect.partKey
                    });
                }
            });
        });
        
        return { ...effect, events: [], stateUpdates };
    },

    // 演出フェーズ
    createTasks: ({ world, effects, messageGenerator }) => {
        const tasks = [];
        if (effects.length > 0) {
            const effect = effects[0];
            const message = messageGenerator.format(MessageKey.SUPPORT_SCAN_SUCCESS, { 
                scanBonus: effect.value, 
                duration: effect.duration 
            });
            tasks.push(createDialogTask(message, { modalType: ModalType.EXECUTION_RESULT }));
        }
        return tasks;
    }
};