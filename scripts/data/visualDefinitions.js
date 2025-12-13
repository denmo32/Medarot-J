/**
 * @file 演出定義 (VisualDefinitions)
 * @description 戦闘イベントに対する演出パターン（メッセージキー、アニメーション、VFXなど）を定義する。
 * VisualSequenceServiceがこの定義を参照してタスクを生成する。
 */
import { EffectType } from '../battle/common/constants.js';
import { MessageKey } from './messageRepository.js';

export const VisualDefinitions = {
    // --- 効果適用時の演出定義 ---
    [EffectType.DAMAGE]: {
        getMessageKey: (effect) => {
            if (effect.isGuardBroken) return MessageKey.GUARD_BROKEN;
            if (effect.isPenetration) return MessageKey.PENETRATION_DAMAGE;
            if (effect.isDefended) return MessageKey.DEFENSE_SUCCESS;
            if (effect.guardianName) return MessageKey.GUARDIAN_DAMAGE; // ガーディアン情報はコンテキストから補完
            return MessageKey.DAMAGE_APPLIED;
        },
        getPrefixKey: (effect) => {
            return effect.isCritical ? MessageKey.CRITICAL_HIT : null;
        },
        shouldShowHpBar: (effect) => effect.value > 0,
    },
    [EffectType.HEAL]: {
        getMessageKey: (effect) => {
            return effect.value > 0 ? MessageKey.HEAL_SUCCESS : MessageKey.HEAL_FAILED;
        },
        shouldShowHpBar: (effect) => effect.value > 0,
    },
    [EffectType.APPLY_SCAN]: {
        getMessageKey: () => MessageKey.SUPPORT_SCAN_SUCCESS,
    },
    [EffectType.APPLY_GLITCH]: {
        getMessageKey: (effect) => {
            return effect.wasSuccessful ? MessageKey.INTERRUPT_GLITCH_SUCCESS : MessageKey.INTERRUPT_GLITCH_FAILED;
        },
    },
    [EffectType.APPLY_GUARD]: {
        getMessageKey: () => MessageKey.DEFEND_GUARD_SUCCESS,
    },
    [EffectType.CONSUME_GUARD]: {
        // ガード消費自体にはメッセージを出さないが、期限切れの場合のみ出す
        getMessageKey: (effect) => {
            return effect.isExpired ? MessageKey.GUARD_EXPIRED : null;
        }
    },

    // --- その他のイベント定義 ---
    DECLARATION: {
        getMessageKey: (ctx) => {
            if (ctx.isSupport) return MessageKey.SUPPORT_DECLARATION;
            if (!ctx.targetId) return MessageKey.ATTACK_MISSED;
            return MessageKey.ATTACK_DECLARATION;
        }
    },
    GUARDIAN_TRIGGER: {
        getMessageKey: () => MessageKey.GUARDIAN_TRIGGERED
    },
    MISS: {
        getMessageKey: () => MessageKey.ATTACK_EVADED
    }
};