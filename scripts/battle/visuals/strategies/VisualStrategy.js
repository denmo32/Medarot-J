/**
 * @file VisualStrategy.js
 * @description 演出生成ストラテジーの基底クラス。
 * 個別のエフェクト結果に対して、どのようなタスク（ダイアログ、アニメーション等）を生成するかを定義する。
 */
export class VisualStrategy {
    /**
     * エフェクト結果に基づき、演出タスクのリストを生成する
     * @param {object} context - 戦闘コンテキスト (CombatContext.data)
     * @param {object} effect - 適用されたエフェクト結果 (EffectResult.data)
     * @param {object} visualConfig - 攻撃パーツの演出設定 (PartVisualConfig)
     * @returns {Array<object>} タスク定義オブジェクトの配列
     */
    createTasks(context, effect, visualConfig) {
        return [];
    }
}