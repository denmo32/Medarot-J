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
        
        // --- データ駆動によるパラメータ抽出 ---
        const statName = params.statName || 'success';      // 上昇させるステータス名
        const valueSource = params.valueSource || 'might';   // 威力計算の参照ステータス
        const valueFactor = params.valueFactor || 0.5;       // 威力係数
        
        const durationSource = params.durationSource || 'success'; // 持続時間計算の参照ステータス
        const durationFactor = params.durationFactor || 200;       // 持続時間係数 (ms)

        // 威力（バフ量）の計算
        const baseMightValue = attackingPart[valueSource] || 0;
        const bonusValue = Math.floor(baseMightValue * valueFactor);
        
        // 持続時間の計算 (ms)
        const baseSuccessValue = attackingPart[durationSource] || 0;
        const durationMs = baseSuccessValue * durationFactor;

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
                    // 同一ステータスに対する既存のバフがあれば上書き（重複防止）
                    activeEffects.effects = activeEffects.effects.filter(e => 
                        !(e.type === EffectType.APPLY_SCAN && e.params?.statName === statName)
                    );

                    activeEffects.effects.push({
                        type: EffectType.APPLY_SCAN,
                        value: bonusValue,
                        duration: durationMs,
                        tickInterval: 1000,   // 1秒ごとに経過をチェック
                        elapsedTime: 0,       // 経過時間初期値
                        partKey: partKey,     // 発動に使用したパーツ情報
                        params: { 
                            statName: statName // StatCalculatorが参照するための識別子
                        }
                    });
                }
            });
        });

        this.finish(world, effectEntityId, {
            type: EffectType.APPLY_SCAN,
            targetId: anchorId,
            value: bonusValue,
            duration: Math.floor(durationMs / 1000), // 表示用に秒へ変換
            stateUpdates
        });
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.APPLY_SCAN];
        return { messageKey: def.keys.default };
    }
}