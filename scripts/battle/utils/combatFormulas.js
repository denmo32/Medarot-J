/**
 * @file 戦闘計算式ユーティリティ
 * ダメージ、回避、防御、クリティカル率など、戦闘におけるあらゆる計算式を定義します。
 * 計算の各ステップを変数化し、ロジックの意図（Why）をコードで表現しています。
 */

import { CONFIG } from '../common/config.js';
import { Parts, PlayerInfo, ActiveEffects, Gauge } from '../core/components/index.js';
import { findBestDefensePart } from './queryUtils.js';
import { ErrorHandler, GameError, ErrorType } from './errorHandler.js';
import { EffectType, AttackType } from '../common/constants.js';

/**
 * 戦闘計算戦略のインターフェース
 * @interface CombatStrategy
 */
export class CombatStrategy {
    calculateEvasionChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDefenseChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateCriticalChance(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateDamage(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateSpeedMultiplier(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    calculateGaugeIncrement(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
    resolveHitOutcome(context) { throw new GameError('Not implemented', ErrorType.CALCULATION_ERROR); }
}

/**
 * デフォルトの戦闘計算戦略実装
 * @class DefaultCombatStrategy
 * @implements {CombatStrategy}
 */
class DefaultCombatStrategy extends CombatStrategy {
    
    calculateEvasionChance({ world, attackerId, targetLegs, attackingPart }) {
        try {
            const mobility = targetLegs?.mobility;
            const success = attackingPart?.success;
            
            // 必要なパラメータが不足している場合は回避不能とする
            if (mobility === undefined || success === undefined) return 0;
            
            const scanBonus = this._calculateScanBonus(world, attackerId);
            const adjustedSuccess = success + scanBonus;
            
            // 計算式: (機動 - (成功 + スキャン補正)) / 係数 + 基礎確率
            // 機動力が命中成功値を上回るほど回避率が上がるロジック
            const formula = CONFIG.FORMULAS.EVASION;
            const mobilityAdvantage = mobility - adjustedSuccess;
            const evasionChance = mobilityAdvantage / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
            
            return this._clampProbability(evasionChance, 0, formula.MAX_CHANCE);
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateEvasionChance' });
            return 0;
        }
    }

    calculateDefenseChance({ targetLegs }) {
        try {
            const armor = targetLegs?.armor;
            if (typeof armor !== 'number') return 0;

            // 計算式: 脚部装甲 / 係数 + 基礎確率
            // 装甲が厚いほど、ダメージを軽減する「防御行動」が発生しやすくなる
            const formula = CONFIG.FORMULAS.DEFENSE;
            const defenseChance = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;

            return this._clampProbability(defenseChance, 0, formula.MAX_CHANCE);
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateDefenseChance' });
            return 0;
        }
    }

    calculateCriticalChance({ attackingPart, targetLegs }) {
        try {
            if (!attackingPart || !targetLegs) return 0;
            
            const success = attackingPart.success || 0;
            const mobility = targetLegs.mobility || 0;
            
            // 成功値が相手の機動力を上回るほどクリティカルが出やすい
            const successAdvantage = Math.max(0, success - mobility);
            
            const config = CONFIG.CRITICAL_HIT;
            const baseChance = successAdvantage / config.DIFFERENCE_FACTOR;
            const typeBonus = config.TYPE_BONUS[attackingPart.type] || 0;
            
            return this._clampProbability(baseChance + typeBonus, 0, 1);
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateCriticalChance' });
            return 0;
        }
    }

    calculateDamage({ attackingPart, attackerLegs, targetLegs, isCritical = false, isDefenseBypassed = false }) {
        try {
            if (!attackingPart || !attackerLegs || !targetLegs) return 0;

            let success = attackingPart.success || 0;
            let might = attackingPart.might || 0;
            const mobility = targetLegs.mobility || 0;
            let armor = targetLegs.armor || 0;

            // 1. 攻撃タイプと脚部性能による補正
            const { successBonus, mightBonus } = this._calculateTypeBonus(attackingPart.type, attackerLegs);
            success += successBonus;
            might += mightBonus;

            // 2. 防御側の安定性による装甲ボーナス
            // 安定性が高いと実質的な装甲値が上がり、被ダメージを抑える
            const stabilityDefenseBonus = Math.floor((targetLegs.stability || 0) / 2);
            armor += stabilityDefenseBonus;
            
            // 3. 基礎ダメージの計算
            let baseDamage;
            if (isCritical) {
                // クリティカル時: 相手の機動と装甲を無視し、成功値をそのままダメージソースにする
                baseDamage = Math.max(0, success);
                // ※CONFIG.FORMULAS.DAMAGE.CRITICAL_MULTIPLIER は最終ダメージに乗算する設計も考えられるが、
                // 現状の仕様（防御無視）を維持する形で実装
            } else {
                // 通常時: (成功 - 機動 - 装甲) がベース
                // isDefenseBypassed(防御不能状態など)なら装甲値を無視
                const effectiveArmor = isDefenseBypassed ? 0 : armor;
                baseDamage = Math.max(0, success - mobility - effectiveArmor);
            }

            // 4. 最終ダメージ計算
            // 基礎ダメージを係数で割り、武器の威力(might)を加算する
            // これにより、威力が最低保証ダメージとして機能する
            const finalDamage = Math.floor(baseDamage / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + might;
            
            return finalDamage;
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateDamage' });
            return 0;
        }
    }

    calculateSpeedMultiplier({ part, factorType }) {
        try {
            if (!part) return 1.0;
            const config = CONFIG.TIME_ADJUSTMENT;
            const impactFactor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;
            
            const might = part.might || 0;
            const success = part.success || 0;
            
            // パーツの性能が高いほど、充填・冷却時間が長くなる（速度倍率が上がるわけではない点に注意が必要だが、
            // 既存ロジックでは speedMultiplier が大きいほど遅くなる仕様と思われるため、変数名とロジックの関係を確認）
            // ※ GaugeSystemの実装: increment = (speed / speedMultiplier) * dt
            //    つまり speedMultiplier が大きいほどゲージの伸びは遅くなる（＝時間がかかる）。
            
            const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
            const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
            
            const performanceScore = mightScore + successScore;
            
            // 基本倍率1.0 + 性能スコアによる加算
            let multiplier = 1.0 + (performanceScore * impactFactor);
            
            // 攻撃タイプによる補正（例: 射撃は速い、など）
            const typeModifier = CONFIG.PART_TYPE_MODIFIERS?.[part.type];
            if (typeModifier?.speedMultiplier) {
                multiplier *= typeModifier.speedMultiplier;
            }
            return multiplier;
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateSpeedMultiplier' });
            return 1.0;
        }
    }

    calculateGaugeIncrement({ world, entityId, deltaTime }) {
        try {
            const gauge = world.getComponent(entityId, Gauge);
            const parts = world.getComponent(entityId, Parts);
            if (!gauge || !parts) return 0;

            const propulsion = parts.legs?.propulsion || 1;
            const speedMultiplier = gauge.speedMultiplier || 1.0;
            
            // 推進力が高いほど速く、speedMultiplier（重さ）が大きいほど遅くなる
            const baseIncrement = (propulsion / CONFIG.FORMULAS.GAUGE.GAUGE_INCREMENT_DIVISOR);
            const timeFactor = (deltaTime / CONFIG.UPDATE_INTERVAL);
            
            return (baseIncrement * timeFactor) / speedMultiplier;
        } catch (error) {
            ErrorHandler.handle(error, { method: 'calculateGaugeIncrement' });
            return 0;
        }
    }

    resolveHitOutcome({ world, attackerId, targetId, attackingPart, targetLegs, initialTargetPartKey }) {
        const defaultOutcome = { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };

        // 支援行動は常に成功
        if (attackingPart.isSupport) {
            return { ...defaultOutcome, isHit: true };
        }

        // ターゲット不在（空振り）
        if (!targetId || !targetLegs) {
            return defaultOutcome;
        }

        // 1. 回避判定
        const evasionChance = this.calculateEvasionChance({ world, attackerId, targetLegs, attackingPart });
        const isEvaded = Math.random() < evasionChance;
        
        if (isEvaded) {
            return defaultOutcome; // 命中せず
        }

        // 2. クリティカル判定
        const critChance = this.calculateCriticalChance({ attackingPart, targetLegs });
        const isCritical = Math.random() < critChance;

        if (isCritical) {
            return { ...defaultOutcome, isHit: true, isCritical: true };
        }

        // 3. 防御判定（クリティカルでない場合のみ）
        const defenseChance = this.calculateDefenseChance({ targetLegs });
        const isDefended = Math.random() < defenseChance;

        if (isDefended) {
            const defensePartKey = findBestDefensePart(world, targetId);
            if (defensePartKey) {
                // 防御成功時はターゲットパーツが防御パーツに変更される
                return { ...defaultOutcome, isHit: true, isDefended: true, finalTargetPartKey: defensePartKey };
            }
        }

        // 通常命中
        return { ...defaultOutcome, isHit: true };
    }

    // --- Helper Methods ---

    _calculateScanBonus(world, attackerId) {
        if (!world || attackerId === undefined) return 0;
        const activeEffects = world.getComponent(attackerId, ActiveEffects);
        if (!activeEffects) return 0;
        
        return activeEffects.effects
            .filter(e => e.type === EffectType.APPLY_SCAN)
            .reduce((total, e) => total + e.value, 0);
    }

    _calculateTypeBonus(attackType, attackerLegs) {
        let successBonus = 0;
        let mightBonus = 0;

        switch (attackType) {
            case AttackType.AIMED_SHOT:
                // 狙い撃ち: 脚部の安定性が成功値に加算される
                successBonus = Math.floor((attackerLegs.stability || 0) / 2);
                break;
            case AttackType.STRIKE:
                // 殴る: 脚部の機動性が成功値に加算される
                successBonus = Math.floor((attackerLegs.mobility || 0) / 2);
                break;
            case AttackType.RECKLESS:
                // がむしゃら: 脚部の推進力が威力に加算される
                mightBonus = Math.floor((attackerLegs.propulsion || 0) / 2);
                break;
        }

        return { successBonus, mightBonus };
    }

    _clampProbability(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}

// 戦略を変更するためのシングルトンオブジェクト
export const CombatCalculator = {
    strategy: new DefaultCombatStrategy(),
    
    setStrategy(newStrategy) {
        if (newStrategy instanceof CombatStrategy) {
            this.strategy = newStrategy;
        } else {
            ErrorHandler.handle(new GameError('Invalid combat strategy provided.', ErrorType.VALIDATION_ERROR));
        }
    },
    
    calculateEvasionChance(context) { return this.strategy.calculateEvasionChance(context); },
    calculateDefenseChance(context) { return this.strategy.calculateDefenseChance(context); },
    calculateCriticalChance(context) { return this.strategy.calculateCriticalChance(context); },
    calculateDamage(context) { return this.strategy.calculateDamage(context); },
    calculateSpeedMultiplier(context) { return this.strategy.calculateSpeedMultiplier(context); },
    calculateGaugeIncrement(context) { return this.strategy.calculateGaugeIncrement(context); },
    resolveHitOutcome(context) { return this.strategy.resolveHitOutcome(context); }
};