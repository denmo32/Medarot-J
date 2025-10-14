/**
 * @file パーツ役割マスターデータ (新規作成)
 * このファイルは、パーツの基本的な「役割」を定義し、関連するデフォルトの振る舞いを集約します。
 * これにより、parts.jsでの個々のパーツ定義が簡潔になり、役割に基づいた一貫性のある設定を保証します。
 */
import { EffectScope, EffectType } from '../common/constants.js';

export const PartRoles = {
    /**
     * @property {string} key - AI戦略などで役割を識別するためのキー。
     * @property {string} targetScope - デフォルトのターゲット範囲。
     * @property {Array<object>} effects - デフォルトの効果定義。
     */

    // 攻撃系ロール
    DAMAGE: {
        key: 'damage',
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [{ type: EffectType.DAMAGE }],
    },
    // 回復系ロール
    HEAL: {
        key: 'heal',
        targetScope: EffectScope.ALLY_SINGLE,
        effects: [{ type: EffectType.HEAL }],
    },
    // 援護系ロール
    SUPPORT_SCAN: {
        key: 'support_scan',
        targetScope: EffectScope.ALLY_TEAM,
        // ★改善: 効果に持続時間(duration)などの追加パラメータを直接定義
        effects: [{ type: EffectType.APPLY_SCAN, duration: 3 }],
    },
    // 妨害系ロール
    SUPPORT_GLITCH: {
        key: 'support_glitch',
        targetScope: EffectScope.ENEMY_SINGLE,
        effects: [{ type: EffectType.APPLY_GLITCH }],
    },
    // 防御系ロール
    DEFENSE: {
        key: 'defense',
        targetScope: EffectScope.SELF,
        // ★改善: ガード回数の計算ロジックをデータとして定義 (威力 * 0.1)
        effects: [{ type: EffectType.APPLY_GUARD, countMultiplier: 0.1 }],
    },
};