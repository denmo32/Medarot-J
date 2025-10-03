/**
 * @file 戦闘計算式ユーティリティ
 * ダメージ、回避、防御、クリティカル率など、戦闘におけるあらゆる計算式を定義します。
 * ゲームバランスの調整は、主にこのファイルと`config.js`で行います。
 * 
 * 注：このファイルには戦闘計算戦略パターンが実装されており、異なる計算アルゴリズムに
 * 切り替えることが可能です。デフォルトの計算アルゴリズムが関数としてエクスポートされており、
 * 必要に応じて別の計算アルゴリズムに置き換えることができます。
 */

import { CONFIG } from '../common/config.js';
import { Parts } from '../core/components.js';
import { findBestDefensePart } from './queryUtils.js'; // ★注意: 依存関係の変更
import { ErrorHandler, GameError, ErrorType } from './errorHandler.js';

/**
 * 戦闘計算戦略のインターフェース
 * @interface CombatStrategy
 */
export class CombatStrategy {
    /**
     * 回避確率を計算する
     * @param {number} mobility - ターゲットの機動値
     * @param {number} success - 攻撃側の成功値
     * @returns {number} 0-1の範囲の確率
     */
    calculateEvasionChance(mobility, success) {
        throw new GameError(
            'calculateEvasionChance method must be implemented',
            ErrorType.CALCULATION_ERROR,
            { method: 'calculateEvasionChance' }
        );
    }

    /**
     * 防御確率を計算する
     * @param {number} armor - ターゲットの防御値
     * @returns {number} 0-1の範囲の確率
     */
    calculateDefenseChance(armor) {
        throw new GameError(
            'calculateDefenseChance method must be implemented',
            ErrorType.CALCULATION_ERROR,
            { method: 'calculateDefenseChance' }
        );
    }

    /**
     * クリティカルヒットの発生確率を計算する関数。
     * @param {object} attackingPart - 攻撃側のパーツ
     * @param {object} targetLegs - ターゲットの脚部パーツ
     * @returns {number} 0-1の範囲の確率
     */
    calculateCriticalChance(attackingPart, targetLegs) {
        throw new GameError(
            'calculateCriticalChance method must be implemented',
            ErrorType.CALCULATION_ERROR,
            { method: 'calculateCriticalChance' }
        );
    }

    /**
     * ダメージを計算する
     * @param {World} world
     * @param {number} attackerId
     * @param {number} targetId
     * @param {object} action
     * @param {boolean} isCritical
     * @param {boolean} isDefenseBypassed
     * @returns {number} 計算されたダメージ値
     */
    calculateDamage(world, attackerId, targetId, action, isCritical = false, isDefenseBypassed = false) {
        throw new GameError(
            'calculateDamage method must be implemented',
            ErrorType.CALCULATION_ERROR,
            { method: 'calculateDamage' }
        );
    }

    /**
     * パーツ性能に基づき、速度補正率を計算する
     * @param {object} part - パーツオブジェクト
     * @param {'charge' | 'cooldown'} factorType - 計算する係数の種類
     * @returns {number} 速度補正率 (1.0が基準)
     */
    calculateSpeedMultiplier(part, factorType) {
        throw new GameError(
            'calculateSpeedMultiplier method must be implemented',
            ErrorType.CALCULATION_ERROR,
            { method: 'calculateSpeedMultiplier' }
        );
    }
}

/**
 * デフォルトの戦闘計算戦略実装
 * @class DefaultCombatStrategy
 * @implements {CombatStrategy}
 */
export class DefaultCombatStrategy extends CombatStrategy {
    /**
     * 回避確率を計算する
     * @param {number} mobility - ターゲットの機動値
     * @param {number} success - 攻撃側の成功値
     * @returns {number} 0-1の範囲の確率
     */
    calculateEvasionChance(mobility, success) {
        try {
            // パラメータの検証
            if (typeof mobility !== 'number' || typeof success !== 'number') {
                throw new GameError(
                    `Invalid parameters for evasion calculation: mobility=${mobility}, success=${success}`,
                    ErrorType.VALIDATION_ERROR,
                    { mobility, success, method: 'calculateEvasionChance' }
                );
            }

            const formula = CONFIG.FORMULAS.EVASION;
            if (!formula) {
                throw new GameError(
                    'Evasion formula configuration is missing',
                    ErrorType.CALCULATION_ERROR,
                    { method: 'calculateEvasionChance' }
                );
            }

            const base = (mobility - success) / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
            return Math.max(0, Math.min(formula.MAX_CHANCE, base));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateEvasionChance', mobility, success });
            return 0; // 通常、回避確率が計算できない場合は0を返す
        }
    }

    /**
     * 防御確率を計算する
     * @param {number} armor - ターゲットの防御値
     * @returns {number} 0-1の範囲の確率
     */
    calculateDefenseChance(armor) {
        try {
            // パラメータの検証
            if (typeof armor !== 'number') {
                throw new GameError(
                    `Invalid parameter for defense calculation: armor=${armor}`,
                    ErrorType.VALIDATION_ERROR,
                    { armor, method: 'calculateDefenseChance' }
                );
            }

            const formula = CONFIG.FORMULAS.DEFENSE;
            if (!formula) {
                throw new GameError(
                    'Defense formula configuration is missing',
                    ErrorType.CALCULATION_ERROR,
                    { method: 'calculateDefenseChance' }
                );
            }

            const base = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;
            return Math.max(0, Math.min(formula.MAX_CHANCE, base));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateDefenseChance', armor });
            return 0; // 通常、防御確率が計算できない場合は0を返す
        }
    }

    /**
     * クリティカルヒットの発生確率を計算する関数。
     * @param {object} attackingPart - 攻撃側のパーツ
     * @param {object} targetLegs - ターゲットの脚部パーツ
     * @returns {number} 0-1の範囲の確率
     */
    calculateCriticalChance(attackingPart, targetLegs) {
        try {
            // パラメータの検証
            if (!attackingPart || typeof attackingPart !== 'object') {
                throw new GameError(
                    `Invalid attackingPart parameter for critical chance calculation: ${attackingPart}`,
                    ErrorType.VALIDATION_ERROR,
                    { attackingPart, targetLegs, method: 'calculateCriticalChance' }
                );
            }
            
            if (!targetLegs || typeof targetLegs !== 'object') {
                throw new GameError(
                    `Invalid targetLegs parameter for critical chance calculation: ${targetLegs}`,
                    ErrorType.VALIDATION_ERROR,
                    { attackingPart, targetLegs, method: 'calculateCriticalChance' }
                );
            }

            const config = CONFIG.CRITICAL_HIT;
            if (!config) return 0;

            const success = attackingPart.success || 0;
            const mobility = targetLegs.mobility || 0;
            const difference = Math.max(0, success - mobility);
            let chance = difference / config.DIFFERENCE_FACTOR;
            const typeBonus = config.TYPE_BONUS[attackingPart.type] || 0;
            chance += typeBonus;
            return Math.max(0, Math.min(1, chance));
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateCriticalChance', attackingPart, targetLegs });
            return 0; // 通常、クリティカル確率が計算できない場合は0を返す
        }
    }

    /**
     * ダメージを計算する
     * @param {object} attackingPart - 攻撃側のパーツ
     * @param {object} attackerLegs - 攻撃側の脚部パーツ
     * @param {object} targetLegs - ターゲットの脚部パーツ
     * @param {boolean} isCritical - クリティカルヒットか
     * @param {boolean} isDefenseBypassed - 防御が貫通されたか
     * @returns {number} 計算されたダメージ値
     */
    calculateDamage(attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false) {
        try {
            // パラメータの検証
            if (!attackingPart || !attackerLegs || !targetLegs) {
                throw new GameError(
                    'Invalid parts data provided for damage calculation.',
                    ErrorType.VALIDATION_ERROR,
                    { attackingPart: !!attackingPart, attackerLegs: !!attackerLegs, targetLegs: !!targetLegs, method: 'calculateDamage' }
                );
            }

            let success = attackingPart.success || 0;
            let might = attackingPart.might || 0;
            const mobility = targetLegs.mobility || 0;
            let armor = targetLegs.armor || 0;

            let bonusType = '';
            let bonusValue = 0;

            // 攻撃タイプに応じたボーナス計算
            switch (attackingPart.type) {
                case '撃つ':
                    // '撃つ'タイプには特別なボーナスがないため、何もしない
                    break;
                case '狙い撃ち':
                    bonusValue = Math.floor((attackerLegs.stability || 0) / 2);
                    success += bonusValue;
                    bonusType = `stability/2 (+${bonusValue})`;
                    break;
                case '殴る':
                    bonusValue = Math.floor((attackerLegs.mobility || 0) / 2);
                    success += bonusValue;
                    bonusType = `mobility/2 (+${bonusValue})`;
                    break;
                case '我武者羅':
                    bonusValue = Math.floor((attackerLegs.propulsion || 0) / 2);
                    might += bonusValue;
                    bonusType = `propulsion/2 (+${bonusValue})`;
                    break;
                default:
                    // 不明な攻撃タイプの場合、警告を出す
                    console.warn(`[WARNING] Unknown attack type: ${attackingPart.type}`);
            }

            // 防御側の脚部パーツによる防御ボーナス
            const defenseBonus = Math.floor((targetLegs.stability || 0) / 2);
            armor += defenseBonus;
            
            let baseDamage;
            if (isCritical) {
                // クリティカルヒットの場合、ターゲットの機動力と装甲を無視
                baseDamage = Math.max(0, success);
            } else {
                if (isDefenseBypassed) {
                    // 防御が貫通された場合、装甲を0として計算
                    armor = 0;
                }
                // 通常のダメージ計算
                baseDamage = Math.max(0, success - mobility - armor);
            }

            const finalDamage = Math.floor(baseDamage / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + might;

            if (CONFIG.DEBUG) {
                console.log(`--- ダメージ計算 ---`);
                console.log(`  攻撃側: 素の成功=${attackingPart.success}, 素の威力=${attackingPart.might}`);
                if (bonusType) {
                    console.log(`  - 攻撃タイプボーナス (${attackingPart.type}): ${bonusType}`);
                }
                console.log(`  => 最終的な攻撃パラメータ: 成功=${success}, 威力=${might}`);
                console.log(`  ターゲット側: 機動=${mobility}, 素の防御=${targetLegs.armor || 0}`);
                if (defenseBonus > 0) {
                    console.log(`  - 防御ボーナス (stability/2): +${defenseBonus}`);
                }
                console.log(`  => 最終的な防御パラメータ: 防御=${armor}`);
                if (isCritical) {
                    console.log('  - ★クリティカルヒット発生！ ターゲットの回避度・防御度を無視！');
                    console.log(`  計算過程: Math.floor(Math.max(0, ${success}) / ${CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR}) + ${might} = ${finalDamage}`);
                } else if (isDefenseBypassed) {
                    console.log('  - ●防御失敗！ ターゲットの防御度を無視！');
                    console.log(`  計算過程: Math.floor(Math.max(0, ${success} - ${mobility} - 0) / ${CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR}) + ${might} = ${finalDamage}`);
                } else {
                    console.log(`  計算過程: Math.floor(Math.max(0, ${success} - ${mobility} - ${armor}) / ${CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR}) + ${might} = ${finalDamage}`);
                }
                console.log(`  - 最終ダメージ: ${finalDamage}`);
            }
            return finalDamage;
        } catch (error) {
            ErrorHandler.handle(error, { 
                method: 'calculateDamage', 
                attackingPart,
                attackerLegs,
                targetLegs,
                isCritical,
                isDefenseBypassed
            });
            return 0; // 計算エラーが発生した場合は0ダメージを返す
        }
    }

    /**
     * パーツ性能に基づき、速度補正率を計算する
     * @param {object} part - パーツオブジェクト
     * @param {'charge' | 'cooldown'} factorType - 計算する係数の種類
     * @returns {number} 速度補正率 (1.0が基準)
     */
    calculateSpeedMultiplier(part, factorType) {
        try {
            if (!part) return 1.0;

            // パラメータの検証
            if (typeof factorType !== 'string' || !['charge', 'cooldown'].includes(factorType)) {
                throw new GameError(
                    `Invalid factorType for speed multiplier calculation: ${factorType}`,
                    ErrorType.VALIDATION_ERROR,
                    { part, factorType, method: 'calculateSpeedMultiplier' }
                );
            }

            const config = CONFIG.TIME_ADJUSTMENT;
            if (!config) {
                throw new GameError(
                    'Time adjustment configuration is missing',
                    ErrorType.CALCULATION_ERROR,
                    { part, factorType, method: 'calculateSpeedMultiplier' }
                );
            }

            const factor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;

            const might = part.might || 0;
            const success = part.success || 0;

            // 性能スコア = (威力 / 最大威力) + (成功 / 最大成功)
            // 基準値が0の場合のゼロ除算を避ける
            const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
            const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
            const performanceScore = mightScore + successScore;

            // 時間補正率 = 1.0 + (性能スコア * 影響係数)
            let multiplier = 1.0 + (performanceScore * factor);

            // ★変更: ハードコードされたロジックをconfigから参照するように修正
            const typeModifier = CONFIG.PART_TYPE_MODIFIERS?.[part.type];
            if (typeModifier?.speedMultiplier) {
                multiplier *= typeModifier.speedMultiplier;
            }

            return multiplier;
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateSpeedMultiplier', part, factorType });
            return 1.0; // 通常、速度補正が計算できない場合は1.0（通常速度）を返す
        }
    }
}

// デフォルトの計算戦略のインスタンス
const defaultStrategy = new DefaultCombatStrategy();

// 旧式の関数形式（後方互換性のため）
/**
 * 回避確率を計算する（後方互換性のための関数）
 * @param {number} mobility - ターゲットの機動値
 * @param {number} success - 攻撃側の成功値
 * @returns {number} 0-1の範囲の確率
 */
export function calculateEvasionChance(mobility, success) {
    return defaultStrategy.calculateEvasionChance(mobility, success);
}

/**
 * 防御確率を計算する（後方互換性のための関数）
 * @param {number} armor - ターゲットの防御値
 * @returns {number} 0-1の範囲の確率
 */
export function calculateDefenseChance(armor) {
    return defaultStrategy.calculateDefenseChance(armor);
}

/**
 * クリティカルヒットの発生確率を計算する関数。（後方互換性のための関数）
 * @param {object} attackingPart - 攻撃側のパーツ
 * @param {object} targetLegs - ターゲットの脚部パーツ
 * @returns {number} 0-1の範囲の確率
 */
export function calculateCriticalChance(attackingPart, targetLegs) {
    return defaultStrategy.calculateCriticalChance(attackingPart, targetLegs);
}

/**
 * ダメージを計算する（後方互換性のための関数）
 * @param {object} attackingPart - 攻撃側のパーツ
 * @param {object} attackerLegs - 攻撃側の脚部パーツ
 * @param {object} targetLegs - ターゲットの脚部パーツ
 * @param {boolean} isCritical - クリティカルヒットか
 * @param {boolean} isDefenseBypassed - 防御が貫通されたか
 * @returns {number} 計算されたダメージ値
 */
export function calculateDamage(attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false) {
    return defaultStrategy.calculateDamage(attackingPart, attackerLegs, targetLegs, isCritical, isDefenseBypassed);
}

/**
 * パーツ性能に基づき、速度補正率を計算する（後方互換性のための関数）
 * @param {object} part - パーツオブジェクト
 * @param {'charge' | 'cooldown'} factorType - 計算する係数の種類
 * @returns {number} 速度補正率 (1.0が基準)
 */
export function calculateSpeedMultiplier(part, factorType) {
    return defaultStrategy.calculateSpeedMultiplier(part, factorType);
}

// 戦略を変更するための関数（必要に応じて利用可能）
export const CombatCalculator = {
    strategy: defaultStrategy,
    
    setStrategy(strategy) {
        try {
            if (strategy instanceof CombatStrategy) {
                this.strategy = strategy;
            } else {
                throw new GameError(
                    'Invalid combat strategy. Must be an instance of CombatStrategy',
                    ErrorType.VALIDATION_ERROR,
                    { providedType: typeof strategy, strategy }
                );
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'setStrategy', strategy });
        }
    },
    
    calculateEvasionChance(mobility, success) {
        return this.strategy.calculateEvasionChance(mobility, success);
    },
    
    calculateDefenseChance(armor) {
        return this.strategy.calculateDefenseChance(armor);
    },
    
    calculateCriticalChance(attackingPart, targetLegs) {
        return this.strategy.calculateCriticalChance(attackingPart, targetLegs);
    },
    
    calculateDamage(attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false) {
        return this.strategy.calculateDamage(attackingPart, attackerLegs, targetLegs, isCritical, isDefenseBypassed);
    },
    
    calculateSpeedMultiplier(part, factorType) {
        return this.strategy.calculateSpeedMultiplier(part, factorType);
    }
};
