/**
 * @file EffectService.js
 * @description 戦闘におけるステータス補正（Modifier）や特性効果を一元管理するサービス。
 * TypeDefinitions, TraitDefinitions, ActiveEffectsを参照し、データ駆動で補正値を計算する。
 */
import { Parts, PlayerInfo } from '../../components/index.js';
import { ActiveEffects } from '../components/index.js';
import { AttackType, EffectType } from '../../common/constants.js';
import { TypeDefinitions } from '../../data/typeDefinitions.js';
import { TraitDefinitions } from '../../data/traitDefinitions.js';

export class EffectService {
    
    /**
     * 指定されたステータスに対する補正値を取得する
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} statName - 'success', 'might', 'mobility', 'evasion' 等
     * @param {object} context - 計算に必要な文脈情報 (attackingPart, attackerLegs 等)
     * @returns {number} 補正値（加算値）
     */
    static getStatModifier(world, entityId, statName, context = {}) {
        let modifier = 0;

        // 1. 攻撃タイプ(Type)による補正
        modifier += this._getTypeModifier(statName, context);

        // 2. 特性(Trait)による補正
        modifier += this._getTraitModifier(statName, context);

        // 3. アクティブ効果（バフ・デバフ）による補正
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

        if (part) {
            // Typeによる補正
            const typeDef = TypeDefinitions[part.type];
            if (typeDef && typeDef.speedMultiplier) {
                multiplier *= typeDef.speedMultiplier;
            }

            // Traitによる補正
            const traitDef = TraitDefinitions[part.trait];
            if (traitDef && traitDef.speedMultiplier) {
                multiplier *= traitDef.speedMultiplier;
            }
        }

        return multiplier;
    }

    /**
     * クリティカル率への加算補正を取得する
     * @param {object} part - 使用するパーツ
     * @returns {number} 加算補正値 (0.0 - 1.0)
     */
    static getCriticalChanceModifier(part) {
        if (!part) return 0;
        let bonus = 0;
        
        // Typeによる補正
        const typeDef = TypeDefinitions[part.type];
        if (typeDef && typeDef.criticalBonus) {
            bonus += typeDef.criticalBonus;
        }

        // Traitによる補正
        const traitDef = TraitDefinitions[part.trait];
        if (traitDef && traitDef.criticalBonus) {
            bonus += traitDef.criticalBonus;
        }

        return bonus;
    }

    // --- Internal Logic ---

    static _getTypeModifier(statName, context) {
        let bonus = 0;
        const { attackingPart, attackerLegs } = context;

        if (attackingPart && attackerLegs) {
            const typeDef = TypeDefinitions[attackingPart.type];
            bonus += this._calculateStatBonusFromDef(typeDef, statName, attackerLegs);
        }
        return bonus;
    }

    static _getTraitModifier(statName, context) {
        let bonus = 0;
        const { attackingPart, attackerLegs } = context;

        if (attackingPart && attackerLegs && attackingPart.trait) {
            const traitDef = TraitDefinitions[attackingPart.trait];
            bonus += this._calculateStatBonusFromDef(traitDef, statName, attackerLegs);
        }
        return bonus;
    }

    static _calculateStatBonusFromDef(def, statName, legs) {
        let bonus = 0;
        if (def && def.statModifiers) {
            for (const mod of def.statModifiers) {
                if (mod.targetStat === statName) {
                    const sourceVal = this._resolveSourceValue(mod.sourceStat, legs);
                    bonus += Math.floor(sourceVal * mod.factor);
                }
            }
        }
        return bonus;
    }

    static _resolveSourceValue(sourcePath, legs) {
        if (!sourcePath || !legs) return 0;
        
        const parts = sourcePath.split('.');
        if (parts[0] === 'legs') {
            return legs[parts[1]] || 0;
        }
        return 0;
    }

    static _getActiveEffectModifier(world, entityId, statName) {
        let bonus = 0;
        if (!world || entityId === undefined || entityId === null) return 0;

        const activeEffects = world.getComponent(entityId, ActiveEffects);
        if (!activeEffects) return 0;

        if (statName === 'success') {
            const scanEffects = activeEffects.effects.filter(e => e.type === EffectType.APPLY_SCAN);
            bonus += scanEffects.reduce((sum, e) => sum + e.value, 0);
        }

        return bonus;
    }
}