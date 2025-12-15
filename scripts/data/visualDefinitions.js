/**
 * @file 演出定義 (VisualDefinitions)
 * @description 戦闘イベントに対する演出設定を定義します。
 * 以前のメソッド(getMessageKey等)は削除し、純粋なデータオブジェクトとして定義します。
 * ロジックはSystem側に移行しました。
 */
import { EffectType } from '../battle/common/constants.js';

export const VisualDefinitions = {
    // 効果種別ごとの基本設定
    [EffectType.DAMAGE]: {
        showHpBar: true,
        // 特定条件下で使用するメッセージキーのマッピングヒント
        keys: {
            default: 'DAMAGE_APPLIED',
            guardBroken: 'GUARD_BROKEN',
            penetration: 'PENETRATION_DAMAGE',
            defended: 'DEFENSE_SUCCESS',
            guardian: 'GUARDIAN_DAMAGE',
            prefixCritical: 'CRITICAL_HIT'
        }
    },
    [EffectType.HEAL]: {
        showHpBar: true,
        keys: {
            success: 'HEAL_SUCCESS',
            failed: 'HEAL_FAILED'
        }
    },
    [EffectType.APPLY_SCAN]: {
        keys: {
            default: 'SUPPORT_SCAN_SUCCESS'
        }
    },
    [EffectType.APPLY_GLITCH]: {
        keys: {
            success: 'INTERRUPT_GLITCH_SUCCESS',
            failed: 'INTERRUPT_GLITCH_FAILED'
        }
    },
    [EffectType.APPLY_GUARD]: {
        keys: {
            default: 'DEFEND_GUARD_SUCCESS'
        }
    },
    [EffectType.CONSUME_GUARD]: {
        keys: {
            expired: 'GUARD_EXPIRED'
        }
    },

    // 汎用イベント設定
    EVENTS: {
        DECLARATION: {
            keys: {
                support: 'SUPPORT_DECLARATION',
                miss: 'ATTACK_MISSED',
                default: 'ATTACK_DECLARATION'
            }
        },
        GUARDIAN_TRIGGER: {
            keys: {
                default: 'GUARDIAN_TRIGGERED'
            }
        },
        MISS: {
            keys: {
                default: 'ATTACK_EVADED'
            }
        }
    }
};