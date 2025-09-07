// scripts/utils/battleUtils.js

import { CONFIG } from '../common/config.js';
import { Parts } from '../core/components.js';
import { PartType } from '../common/constants.js';

/**
 * ダメージ計算を行う関数
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {number} targetId - ターゲットのエンティティID
 * @param {object} action - 攻撃者が選択したアクション
 * @returns {number} 計算されたダメージ値
 */
export function calculateDamage(world, attackerId, targetId, action) {
    const attackerParts = world.getComponent(attackerId, Parts);
    const attackingPart = attackerParts[action.partKey];

    // 将来的には、防御力や相性も考慮できます
    // const targetParts = world.getComponent(targetId, Parts);

    // パーツのpowerをダメージの基本値とします
    return attackingPart.power || 0;
}

/**
 * 指定されたエンティティのパーツを取得します。
 * フィルタリングオプションにより、攻撃用パーツのみ、または全てのパーツを取得可能。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - エンティティID
 * @param {boolean} includeBroken - 破壊されたパーツも含めるか（デフォルト: false）
 * @param {boolean} attackableOnly - 攻撃用パーツのみ取得するか（デフォルト: true）
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getParts(world, entityId, includeBroken = false, attackableOnly = true) {
    if (!world || entityId === null || entityId === undefined) return [];
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return [];

    let partTypes = attackableOnly ? [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM] : Object.keys(parts);

    return Object.entries(parts)
        .filter(([key, part]) => partTypes.includes(key) && (includeBroken || !part.isBroken));
}

/**
 * 指定されたエンティティの、破壊されていない「攻撃用」パーツのリストを取得します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - エンティティID
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getAttackableParts(world, entityId) {
    return getParts(world, entityId, false, true);
}

/**
 * 指定されたエンティティの、破壊状態に関わらず全ての「攻撃用」パーツのリストを取得します。
 * 行動選択UIで、破壊されたパーツを無効状態で表示するために使用します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - エンティティID
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getAllActionParts(world, entityId) {
    return getParts(world, entityId, true, true);
}

/**
 * 防御に最適なパーツ（頭部以外で最もHPが高い）を見つけます。
 * @param {World} world
 * @param {number} entityId - 防御側のエンティティID
 * @returns {string | null} - 最適な防御パーツのキー、またはnull
 */
export function findBestDefensePart(world, entityId) {
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;

    const defendableParts = Object.entries(parts)
        .filter(([key, part]) => key !== PartType.HEAD && !part.isBroken);

    if (defendableParts.length === 0) return null;

    // HPで降順ソートして、最もHPが高いパーツを返す
    defendableParts.sort(([, a], [, b]) => b.hp - a.hp);

    return defendableParts[0][0]; // [key, part] の key を返す
}
