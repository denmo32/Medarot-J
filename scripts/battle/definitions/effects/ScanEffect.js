/**
 * @file ScanEffect.js
 * @description スキャン効果の定義
 * createVisualsメソッドは削除され、VisualSequenceServiceとVisualDefinitionsに責務が移譲されました。
 */
import { EffectType, EffectScope } from '../../common/constants.js';
import { PlayerInfo } from '../../../components/index.js';
import { ActiveEffects } from '../../components/index.js';
import { TargetingService } from '../../services/TargetingService.js';

export const ScanEffect = {
    type: EffectType.APPLY_SCAN,

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

    apply: ({ world, effect }) => {
        if (!effect.scope?.endsWith('_TEAM')) return { ...effect, events: [], stateUpdates: [] };
        
        const allies = TargetingService.getValidAllies(world, effect.targetId, true);
        const stateUpdates = [];

        allies.forEach(targetId => {
            // 配列操作は複雑なため、CUSTOM_UPDATE を使用するが、
            // ハンドラ自体は純粋関数的に振る舞わせる（Worldを書き換えるロジックをApplyStateTaskに任せる）
            stateUpdates.push({
                type: 'CUSTOM_UPDATE',
                targetId,
                componentType: ActiveEffects,
                customHandler: (activeEffects) => {
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
    }
};