/**
 * @file EffectRegistry.js
 * @description 全てのアクション効果定義（計算・適用・演出・更新ロジック）を集約管理するレジストリ。
 */
import { EffectType } from '../../common/constants.js';
import { DamageEffect } from './effects/DamageEffect.js';
import { HealEffect } from './effects/HealEffect.js';
import { ScanEffect } from './effects/ScanEffect.js';
import { GlitchEffect } from './effects/GlitchEffect.js';
import { GuardEffect } from './effects/GuardEffect.js';
import { ConsumeGuardEffect } from './effects/ConsumeGuardEffect.js';

const registry = {
    [EffectType.DAMAGE]: DamageEffect,
    [EffectType.HEAL]: HealEffect,
    [EffectType.APPLY_SCAN]: ScanEffect,
    [EffectType.APPLY_GLITCH]: GlitchEffect,
    [EffectType.APPLY_GUARD]: GuardEffect,
    [EffectType.CONSUME_GUARD]: ConsumeGuardEffect,
};

export class EffectRegistry {
    /**
     * 指定された効果タイプに対応する定義オブジェクトを取得する
     * @param {string} type EffectType
     * @returns {object|null} EffectDefinition
     */
    static get(type) {
        return registry[type] || null;
    }

    /**
     * 計算フェーズ: 効果の具体的な数値を算出する
     * @param {string} type EffectType
     * @param {object} context 計算コンテキスト
     * @returns {object|null} 計算結果オブジェクト
     */
    static process(type, context) {
        const def = this.get(type);
        if (def && typeof def.process === 'function') {
            return def.process(context);
        }
        return null;
    }

    /**
     * 適用フェーズ: 効果をWorldに適用し、結果情報を返す
     * @param {string} type EffectType
     * @param {object} context 適用コンテキスト { world, effect }
     * @returns {object} 適用結果 (effectオブジェクトに適用結果情報をマージしたもの)
     */
    static apply(type, context) {
        const def = this.get(type);
        if (def && typeof def.apply === 'function') {
            return def.apply(context);
        }
        // 定義がない場合は何もしないが、最低限effect自体は返す
        return { ...context.effect, events: [] };
    }

    /**
     * 演出フェーズ: 効果に対応する演出タスクリストを生成する
     * @param {string} type EffectType
     * @param {object} context 演出生成コンテキスト { world, effects, guardianInfo, messageGenerator }
     * @returns {Array} タスクリスト
     */
    static createTasks(type, context) {
        const def = this.get(type);
        if (def && typeof def.createTasks === 'function') {
            return def.createTasks(context);
        }
        return [];
    }

    /**
     * 時間経過フェーズ: 効果の時間経過処理を行う
     * @param {string} type EffectType
     * @param {object} context { world, entityId, effect, deltaTime }
     * @returns {object|null} 更新結果 (ダメージ発生時などはオブジェクトを返す)
     */
    static update(type, context) {
        const def = this.get(type);
        if (def && typeof def.update === 'function') {
            return def.update(context);
        }
        return null;
    }
}