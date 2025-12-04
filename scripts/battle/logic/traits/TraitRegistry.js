/**
 * @file TraitRegistry.js
 * @description 特性（Trait）や攻撃タイプ（Type）固有の動的ロジックを管理するレジストリ。
 * 静的なパラメータ定義だけでは表現できない動的な補正計算を提供する。
 */

const traits = {
    // 汎用: 特定のステータスに補正を掛ける
    'STAT_MODIFIER': {
        onCalculateStat: (context, params) => {
            const { targetStat, currentVal, actorLegs } = context;
            if (targetStat !== params.targetStat) return 0;

            let bonus = 0;
            if (params.sourceStat) {
                // "legs.stability" のようなドット記法を解決
                const parts = params.sourceStat.split('.');
                let sourceVal = 0;
                if (parts[0] === 'legs' && actorLegs) {
                    sourceVal = actorLegs[parts[1]] || 0;
                }
                bonus = Math.floor(sourceVal * (params.factor || 0));
            } else if (params.addValue) {
                bonus = params.addValue;
            }
            return bonus;
        }
    },

    // 例: 狙い撃ち (クリティカル率アップ)
    'AIMED_SHOT_LOGIC': {
        onCalculateCritical: (context, params) => {
            return params.bonus || 0; // 加算する確率 (0.0 - 1.0)
        }
    },

    // 例: 速度補正
    'SPEED_MODIFIER': {
        onCalculateSpeedMultiplier: (context, params) => {
            return params.multiplier || 1.0; // 乗算
        }
    }
};

export class TraitRegistry {
    static getLogic(key) {
        return traits[key];
    }

    static register(key, logic) {
        traits[key] = logic;
    }
}