/**
 * @file 戦闘計算式ユーティリティ
 * ダメージ、回避、防御、クリティカル率など、戦闘におけるあらゆる計算式を定義します。
 * ゲームバランスの調整は、主にこのファイルと`config.js`で行います。
 */

import { CONFIG } from '../common/config.js';
import { Parts } from '../core/components.js';
import { findBestDefensePart } from './queryUtils.js'; // ★注意: 依存関係の変更

/**
 * 回避確率を計算する
 * @param {number} mobility - ターゲットの機動値
 * @param {number} success - 攻撃側の成功値
 * @returns {number} 0-1の範囲の確率
 */
export function calculateEvasionChance(mobility, success) {
    const formula = CONFIG.FORMULAS.EVASION;
    const base = (mobility - success) / formula.DIFFERENCE_DIVISOR + formula.BASE_CHANCE;
    return Math.max(0, Math.min(formula.MAX_CHANCE, base));
}

/**
 * 防御確率を計算する
 * @param {number} armor - ターゲットの防御値
 * @returns {number} 0-1の範囲の確率
 */
export function calculateDefenseChance(armor) {
    const formula = CONFIG.FORMULAS.DEFENSE;
    const base = armor / formula.ARMOR_DIVISOR + formula.BASE_CHANCE;
    return Math.max(0, Math.min(formula.MAX_CHANCE, base));
}

/**
 * クリティカルヒットの発生確率を計算する関数。
 * @param {object} attackingPart - 攻撃側のパーツ
 * @param {object} targetLegs - ターゲットの脚部パーツ
 * @returns {number} 0-1の範囲の確率
 */
export function calculateCriticalChance(attackingPart, targetLegs) {
    const config = CONFIG.CRITICAL_HIT;
    if (!config) return 0;

    const success = attackingPart.success || 0;
    const mobility = targetLegs.mobility || 0;
    const difference = Math.max(0, success - mobility);
    let chance = difference / config.DIFFERENCE_FACTOR;
    const typeBonus = config.TYPE_BONUS[attackingPart.type] || 0;
    chance += typeBonus;
    return Math.max(0, Math.min(1, chance));
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
export function calculateDamage(world, attackerId, targetId, action, isCritical = false, isDefenseBypassed = false) {
    const attackerParts = world.getComponent(attackerId, Parts);
    const attackingPart = attackerParts[action.partKey];
    const targetParts = world.getComponent(targetId, Parts);
    if (!attackingPart || !targetParts) return 0;

    let success = attackingPart.success || 0;
    let might = attackingPart.might || 0;
    const mobility = targetParts.legs.mobility || 0;
    let armor = targetParts.legs.armor || 0;

    const attackerLegs = attackerParts.legs;
    let bonusType = '';
    let bonusValue = 0;

    switch (attackingPart.type) {
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
    }

    const targetLegs = targetParts.legs;
    const defenseBonus = Math.floor((targetLegs.stability || 0) / 2);
    armor += defenseBonus;
    
    let baseDamage;
    if (isCritical) {
        baseDamage = Math.max(0, success);
    } else {
        if (isDefenseBypassed) {
            armor = 0;
        }
        baseDamage = Math.max(0, success - mobility - armor);
    }

    const finalDamage = Math.floor(baseDamage / CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR) + might;

    if (CONFIG.DEBUG) {
        console.log(`--- ダメージ計算 (Attacker: ${attackerId}, Target: ${targetId}) ---`);
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
            console.log(`  計算過程: Math.floor(Math.max(0, ${success}) / 4) + ${might} = ${finalDamage}`);
        } else if (isDefenseBypassed) {
            console.log('  - ●防御失敗！ ターゲットの防御度を無視！');
            console.log(`  計算過程: Math.floor(Math.max(0, ${success} - ${mobility} - 0) / 4) + ${might} = ${finalDamage}`);
        } else {
            console.log(`  計算過程: Math.floor(Math.max(0, ${success} - ${mobility} - ${armor}) / ${CONFIG.FORMULAS.DAMAGE.BASE_DAMAGE_DIVISOR}) + ${might} = ${finalDamage}`);
        }
        console.log(`  - 最終ダメージ: ${finalDamage}`);
    }
    return finalDamage;
}
