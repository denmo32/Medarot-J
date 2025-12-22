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

        // mightパラメータに基づいてパラメータ上昇量を計算
        const mightValue = attackingPart['might'] || 0;
        const scanBonusValue = Math.floor(mightValue * valueFactor);
        
        // successパラメータに基づいて効果持続時間を計算（時間ベース）
        const successValue = attackingPart['success'] || 0;
        // success値をもとにミリ秒単位の持続時間を計算（例: success値×1000ms）
        const durationMs = successValue * 1000;

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
                        duration: durationMs, // ターン数からミリ秒に変更
                        tickInterval: 1000,   // 1秒ごとに経過をチェック
                        elapsedTime: 0,       // 経過時間初期値
                        partKey: partKey      // 発動に使用したパーツ情報
                    });
                }
            });
        });

        this.finish(world, effectEntityId, {
            type: EffectType.APPLY_SCAN,
            targetId: anchorId,
            value: scanBonusValue,
            duration: Math.floor(durationMs / 1000), // ミリ秒から秒に変換
            stateUpdates
        });
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.APPLY_SCAN];
        return { messageKey: def.keys.default };
    }
}
