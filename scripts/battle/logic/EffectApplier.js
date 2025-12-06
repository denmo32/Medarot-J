/**
 * @file EffectApplier.js
 * @description 戦闘計算結果に基づいてWorldにイベントを発行する。
 * 実際のデータ更新責務は各EffectDefinitionのapplyフェーズに移動したため、
 * ここではイベントのディスパッチが主な役割となる。
 */
import { EffectRegistry } from '../definitions/EffectRegistry.js';

export class EffectApplier {
    /**
     * 計算済みの効果のイベントをWorldに適用する
     * @param {World} world 
     * @param {object} resultData BattleResolverの計算結果
     */
    static applyResult(world, resultData) {
        const { appliedEffects } = resultData;
        
        if (!appliedEffects) return;

        appliedEffects.forEach(effect => {
            // イベント処理 (各Effectのapplyフェーズで生成されたイベントを発行)
            if (effect.events) {
                effect.events.forEach(e => world.emit(e.type, e.payload));
            }
        });
    }
}