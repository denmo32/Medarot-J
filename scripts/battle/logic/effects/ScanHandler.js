/**
 * @file ScanHandler.js
 * @description スキャン付与 (APPLY_SCAN) のロジック。
 */
import { EffectHandler } from './EffectHandler.js';
import { ActiveEffects } from '../../components/index.js'; // Battle
import { EffectType } from '../../common/constants.js';
import { TargetingService } from '../../services/TargetingService.js';
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

        // コンテキストのターゲット（通常はALLY_TEAM）に対して効果を付与
        // Note: EffectContext生成時にTargetingSystemで解決されたターゲットが入っているが、
        // TEAM_SCANのような全体効果の場合、TargetingServiceで範囲取得し直すのが確実。
        // ここではEffectContext.targetIdを「主ターゲット（味方リーダー等）」とし、
        // そこからチーム全体を取得するロジックとする。
        const targets = TargetingService.getValidAllies(world, targetId, true);
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