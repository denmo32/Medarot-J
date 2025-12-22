/**
 * @file ScanHandler.js
 * @description スキャン（命中バフ）適用のロジック。
 */
import { EffectHandler } from './EffectHandler.js';
import { ActiveEffects } from '../../components/index.js'; // Battle
import { EffectType } from '../../common/constants.js';
import { BattleQueries } from '../../queries/BattleQueries.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';

export class ScanHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { sourceId, targetId, partKey, attackingPart } = context;

        const params = effect.params || {};
        const valueSource = params.valueSource || 'might';
        const valueFactor = params.valueFactor || 0.1;
        const duration = params.duration || 3;

        const baseValue = attackingPart[valueSource] || 0;
        const scanBonusValue = Math.floor(baseValue * valueFactor);

        // チーム全体が対象の場合、targetIdがnullになるケースがあるため、
        // sourceId（自分自身）を基点に有効な味方（自分を含む）を取得する
        const anchorId = targetId !== null ? targetId : sourceId;
        const targets = BattleQueries.getValidAllies(world, anchorId, true);
        const stateUpdates = [];

        targets.forEach(tid => {
            stateUpdates.push({
                type: 'CustomUpdateComponent',
                targetId: tid,
                componentType: ActiveEffects,
                customHandler: (activeEffects) => {
                    // 重複排除（上書き）
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_SCAN);
                    activeEffects.effects.push({
                        type: EffectType.APPLY_SCAN,
                        value: scanBonusValue,
                        duration: duration,
                        partKey: partKey // 発動に使用したパーツ情報
                    });
                }
            });
        });

        this.finish(world, effectEntityId, {
            type: EffectType.APPLY_SCAN,
            targetId: anchorId,
            value: scanBonusValue,
            duration,
            stateUpdates
        });
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.APPLY_SCAN];
        return { messageKey: def.keys.default };
    }
}