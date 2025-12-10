/**
 * @file EffectRegistry.js
 * @description 全てのアクション効果定義を集約管理するレジストリ。
 * apply メソッドは World を変更せず、更新データ(diff)を返すように変更。
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
    static get(type) {
        return registry[type] || null;
    }

    static process(type, context) {
        const def = this.get(type);
        if (def && typeof def.process === 'function') {
            return def.process(context);
        }
        return null;
    }

    /**
     * 適用データ生成フェーズ
     * Worldの現状を参照して、適用すべき状態変更(stateUpdates)と発生イベント(events)を生成して返す。
     * 実際にWorldを変更してはならない。
     */
    static apply(type, context) {
        const def = this.get(type);
        if (def && typeof def.apply === 'function') {
            return def.apply(context);
        }
        return { ...context.effect, events: [], stateUpdates: [] };
    }

    static createTasks(type, context) {
        const def = this.get(type);
        if (def && typeof def.createTasks === 'function') {
            return def.createTasks(context);
        }
        return [];
    }

    static update(type, context) {
        const def = this.get(type);
        if (def && typeof def.update === 'function') {
            return def.update(context);
        }
        return null;
    }
}