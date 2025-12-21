/**
 * @file ScanHandler.js
 * @description TargetingServiceへの依存をQueryServiceへ変更。
 */
import { EffectHandler } from './EffectHandler.js';
import { ActiveEffects } from '../../components/index.js'; // Battle
import { EffectType } from '../../common/constants.js';
import { QueryService } from '../../services/QueryService.js';
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

        // 主ターゲット（リーダー等）からチーム全体を取得
        const targets = QueryService.getValidAllies(world, targetId, true);
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