/**
 * @file パーツ役割マスターデータ
 * このファイルは、パーツの基本的な「役割」を識別するためのキーを定義します。
 * 行動の振る舞いに関する定義は `actionDefinitions.js`で管理。
 * このファイルはAI戦略やUI分類のための「タグ」としての役割に特化します。
 */

export const PartRoles = {
    /**
     * @property {string} key - AI戦略などで役割を識別するためのキー。
     */
    // 攻撃系ロール
    DAMAGE: {
        key: 'damage',
    },
    // 回復系ロール
    HEAL: {
        key: 'heal',
    },
    // 援護系ロール
    SUPPORT_SCAN: {
        key: 'support_scan',
    },
    // 妨害系ロール
    SUPPORT_GLITCH: {
        key: 'support_glitch',
    },
    // 防御系ロール
    DEFENSE: {
        key: 'defense',
    },
};

/**
 * パーツの役割を識別するためのキーを定義する定数 (PartRolesから自動生成)
 * このファイルを信頼できる唯一の情報源 (Single Source of Truth) とし、
 * 手動での定数定義との二重管理をなくすことで、保守性を向上させます。
 */
export const PartRoleKey = Object.keys(PartRoles).reduce((acc, key) => {
    // 例: DAMAGE -> acc['DAMAGE'] = 'damage'
    acc[key] = PartRoles[key].key;
    return acc;
}, {});