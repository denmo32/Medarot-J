/**
 * @file パーツ役割マスターデータ (新規作成)
 * このファイルは、パーツの基本的な「役割」を定義し、関連するデフォルトの振る舞いを集約します。
 * これにより、parts.jsでの個々のパーツ定義が簡潔になり、役割に基づいた一貫性のある設定を保証します。
 */
// ★修正: ActionTypeを追加でインポート
import { EffectScope, EffectType, ActionType } from '../common/constants.js';

export const PartRoles = {
    /**
     * @property {string} key - AI戦略などで役割を識別するためのキー。
     * @property {ActionType} actionType - システムがロジック分岐に使うための論理的なアクション分類。
     * @property {boolean} isSupport - これが支援（非ダメージ）系のアクションかを判定するフラグ。
     * @property {string} targetScope - デフォルトのターゲット範囲。
     * @property {Array<object>} effects - デフォルトの効果定義。
     */

    // 攻撃系ロール
    DAMAGE: {
        key: 'damage',
        // ★新規: アクションの論理タイプと支援フラグを追加
        actionType: ActionType.SHOOT, // デフォルトは射撃。格闘パーツは個別に上書きする。
        isSupport: false,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [{ type: EffectType.DAMAGE }],
    },
    // 回復系ロール
    HEAL: {
        key: 'heal',
        // ★新規: アクションの論理タイプと支援フラグを追加
        actionType: ActionType.HEAL,
        isSupport: true,
        targetScope: EffectScope.ALLY_SINGLE,
        effects: [{ type: EffectType.HEAL }],
    },
    // 援護系ロール
    SUPPORT_SCAN: {
        key: 'support_scan',
        // ★新規: アクションの論理タイプと支援フラグを追加
        actionType: ActionType.SUPPORT,
        isSupport: true,
        targetScope: EffectScope.ALLY_TEAM,
        // ★改善: 効果に持続時間(duration)などの追加パラメータを直接定義
        effects: [{ type: EffectType.APPLY_SCAN, duration: 3 }],
    },
    // 妨害系ロール
    SUPPORT_GLITCH: {
        key: 'support_glitch',
        // ★新規: アクションの論理タイプと支援フラグを追加
        actionType: ActionType.INTERRUPT,
        isSupport: true,
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [{ type: EffectType.APPLY_GLITCH }],
    },
    // 防御系ロール
    DEFENSE: {
        key: 'defense',
        // ★新規: アクションの論理タイプと支援フラグを追加
        actionType: ActionType.DEFEND,
        isSupport: true,
        targetScope: EffectScope.SELF,
        // ★改善: ガード回数の計算ロジックをデータとして定義 (威力 * 0.1)
        effects: [{ type: EffectType.APPLY_GUARD, countMultiplier: 0.1 }],
    },
};

/**
 * ★新規: パーツの役割を識別するためのキーを定義する定数 (PartRolesから自動生成)
 * このファイルを信頼できる唯一の情報源 (Single Source of Truth) とし、
 * 手動での定数定義との二重管理をなくすことで、保守性を向上させます。
 */
export const PartRoleKey = Object.keys(PartRoles).reduce((acc, key) => {
    // 例: DAMAGE -> acc['DAMAGE'] = 'damage'
    acc[key] = PartRoles[key].key;
    return acc;
}, {});