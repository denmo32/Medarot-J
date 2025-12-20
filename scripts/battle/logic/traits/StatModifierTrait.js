/**
 * @file StatModifierTrait.js
 * @description ステータス補正を行う汎用特性ロジック。
 * 狙い撃ち（脚部安定を加算）や、格闘（脚部機動を加算）などを処理。
 */
import { TraitLogic } from './TraitLogic.js';

export class StatModifierTrait extends TraitLogic {
    ON_CALCULATE_STAT(context) {
        const { params, targetStat, attackerLegs } = context;
        // params は TypeDefinitions や TraitDefinitions から渡される設定オブジェクト
        // { targetStat: 'success', sourceStat: 'legs.stability', factor: 0.5 } など

        if (!params || params.targetStat !== targetStat) return 0;

        let bonus = 0;
        if (params.sourceStat) {
            // "legs.stability" のようなドット記法を解決
            const parts = params.sourceStat.split('.');
            let sourceVal = 0;
            if (parts[0] === 'legs' && attackerLegs) {
                sourceVal = attackerLegs[parts[1]] || 0;
            }
            bonus = Math.floor(sourceVal * (params.factor || 0));
        } else if (params.addValue) {
            bonus = params.addValue;
        }
        return bonus;
    }

    ON_CALCULATE_CRITICAL(context) {
        const { params } = context;
        // { criticalBonus: 0.5 } など
        return params && params.criticalBonus ? params.criticalBonus : 0;
    }

    ON_CALCULATE_SPEED_MULTIPLIER(context) {
        const { params } = context;
        // { speedMultiplier: 0.75 } など
        return params && params.speedMultiplier !== undefined ? params.speedMultiplier : 1.0;
    }
}