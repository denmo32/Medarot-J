/**
 * @file EffectApplyService.js
 * @description 戦闘計算結果に基づいてWorldにイベントを発行するサービス。
 * (旧 EffectApplier.js)
 */

export class EffectApplyService {
    /**
     * 計算済みの効果のイベントをWorldに適用する
     * @param {World} world 
     * @param {object} resultData BattleResolutionServiceの計算結果
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