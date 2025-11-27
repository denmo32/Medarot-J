/**
 * @file パーツ役割マスターデータ
 * このファイルは、パーツの基本的な「役割」を識別するためのキーを定義します。
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
 * パーツの役割を識別するためのキーを定義する定数
 */
export const PartRoleKey = Object.keys(PartRoles).reduce((acc, key) => {
    acc[key] = PartRoles[key].key;
    return acc;
}, {});