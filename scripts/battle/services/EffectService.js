/**
 * @file EffectService.js
 * @description 戦闘におけるステータス補正（Modifier）や特性効果を一元管理するサービス。
 * 将来的にはパッシブ効果や状態異常による補正もここで集計する。
 */
import { Parts, PlayerInfo } from '../../components/index.js';
import { ActiveEffects } from '../components/index.js';
import { AttackType, EffectType } from '../../common/constants.js';

export class EffectService {
    
    /**
     * 指定されたステータスに対する補正値を取得する
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} statName - 'success', 'might', 'mobility', 'evasion' 等
     * @param {object} context - 計算に必要な文脈情報 (attackingPart, targetLegs 等)
     * @returns {number} 補正値（加算値）
     */
    static getStatModifier(world, entityId, statName, context = {}) {
        let modifier = 0;

        // 1. パーツ特性による補正 (Trait)
        modifier += this._getTraitModifier(world, entityId, statName, context);

        // 2. アクティブ効果（バフ・デバフ）による補正
        modifier += this._getActiveEffectModifier(world, entityId, statName);

        return modifier;
    }

    /**
     * 速度係数（チャージ/冷却の倍率）に対する補正を取得する
     * @param {World} world 
     * @param {number} entityId 
     * @param {object} part - 使用するパーツ
     * @returns {number} 乗算補正値 (初期値 1.0)
     */
    static getSpeedMultiplierModifier(world, entityId, part) {
        let multiplier = 1.0;

        if (part && part.type === AttackType.SHOOT) {
            multiplier *= 0.75; // 射撃はチャージが早い（例）
        }

        return multiplier;
    }

    // --- Internal Logic ---

    static _getTraitModifier(world, entityId, statName, context) {
        let bonus = 0;
        const { attackingPart, attackerLegs } = context;

        // 攻撃側の特性補正
        if (attackingPart && attackerLegs) {
            // 特性ロジック (旧 CombatCalculator._calculateTypeBonus 相当)
            // 将来的には trait データ定義自体に "success_bonus_source": "stability" のように持たせる
            switch (attackingPart.type) {
                case AttackType.AIMED_SHOT:
                    if (statName === 'success') {
                        bonus += Math.floor((attackerLegs.stability || 0) / 2);
                    }
                    break;
                case AttackType.STRIKE:
                    if (statName === 'success') {
                        bonus += Math.floor((attackerLegs.mobility || 0) / 2);
                    }
                    break;
                case AttackType.RECKLESS:
                    if (statName === 'might') {
                        bonus += Math.floor((attackerLegs.propulsion || 0) / 2);
                    }
                    break;
            }
        }

        return bonus;
    }

    static _getActiveEffectModifier(world, entityId, statName) {
        let bonus = 0;
        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (!activeEffects) return 0;

        // スキャン効果 (命中/成功率アップ)
        if (statName === 'success') {
            const scanEffects = activeEffects.effects.filter(e => e.type === EffectType.APPLY_SCAN);
            bonus += scanEffects.reduce((sum, e) => sum + e.value, 0);
        }

        return bonus;
    }
}