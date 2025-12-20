/**
 * @file EffectHandler.js
 * @description エフェクト処理ロジックの基底クラス。
 * 各種エフェクト（ダメージ、回復など）の計算と適用、演出情報の解決を担当する。
 */
import { ApplyEffect, EffectResult } from '../../components/effects/Effects.js';

export class EffectHandler {
    /**
     * エフェクトを適用する
     * @param {World} world 
     * @param {number} effectEntityId - ApplyEffectコンポーネントを持つエンティティID
     * @param {ApplyEffect} effect - 適用するエフェクトデータ
     * @param {EffectContext} context - エフェクトのコンテキスト
     */
    apply(world, effectEntityId, effect, context) {
        throw new Error('EffectHandler.apply() must be implemented.');
    }

    /**
     * 処理結果に基づいて演出用のメッセージキーやパラメータを解決する
     * @param {object} resultData - EffectResult.data
     * @param {object} visualConfig - パーツ固有の演出設定 (PartVisualConfig)
     * @returns {object|null} { messageKey: string, params: object }
     */
    resolveVisual(resultData, visualConfig) {
        return null;
    }

    /**
     * 処理を完了し、結果コンポーネントを付与するヘルパー
     * @param {World} world 
     * @param {number} entityId 
     * @param {object} resultData 
     */
    finish(world, entityId, resultData) {
        world.removeComponent(entityId, ApplyEffect);
        world.addComponent(entityId, new EffectResult(resultData));
    }
}