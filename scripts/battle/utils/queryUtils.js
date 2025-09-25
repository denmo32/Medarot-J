/**
 * @file クエリユーティリティ
 * ワールド（ECS）から特定の条件に基づいてエンティティやコンポーネントを
 * 問い合わせる（検索・取得する）ためのユーティリティ関数群です。
 */

import { Parts, Position, PlayerInfo, GameState } from '../core/components.js';
import { PartInfo, PlayerStateType } from '../common/constants.js';

/**
 * 指定されたエンティティのパーツを取得します。
 * @param {World} world
 * @param {number} entityId
 * @param {boolean} includeBroken - 破壊されたパーツも含めるか
 * @param {boolean} attackableOnly - 攻撃用パーツのみ取得するか
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getParts(world, entityId, includeBroken = false, attackableOnly = true) {
    if (!world || entityId === null || entityId === undefined) return [];
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return [];
    
    const attackablePartKeys = [PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key];
    
    let partTypes = attackableOnly 
        ? attackablePartKeys 
        : Object.keys(parts);
        
    return Object.entries(parts)
        .filter(([key, part]) => partTypes.includes(key) && (includeBroken || !part.isBroken));
}

/**
 * 指定されたエンティティの、破壊されていない「攻撃用」パーツのリストを取得します。
 * @param {World} world
 * @param {number} entityId
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getAttackableParts(world, entityId) {
    return getParts(world, entityId, false, true);
}

/**
 * 指定されたエンティティの、破壊状態に関わらず全ての「攻撃用」パーツのリストを取得します。
 * @param {World} world
 * @param {number} entityId
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
        .filter(([key, part]) => key !== PartInfo.HEAD.key && !part.isBroken);
    if (defendableParts.length === 0) return null;
    defendableParts.sort(([, a], [, b]) => b.hp - a.hp);
    return defendableParts[0][0];
}

/**
 * 生存している敵エンティティのリストを取得します
 * @param {World} world
 * @param {number} attackerId
 * @returns {number[]}
 */
export function getValidEnemies(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    return world.getEntitiesWith(PlayerInfo, GameState)
        .filter(id => {
            const pInfo = world.getComponent(id, PlayerInfo);
            const gState = world.getComponent(id, GameState);
            return id !== attackerId && pInfo.teamId !== attackerInfo.teamId && gState.state !== PlayerStateType.BROKEN;
        });
}

/**
 * 指定されたターゲットIDやパーツキーが現在有効（生存・未破壊）か検証します。
 * @param {World} world
 * @param {number} targetId
 * @param {string | null} partKey
 * @returns {boolean}
 */
export function isValidTarget(world, targetId, partKey = null) {
    if (targetId === null || targetId === undefined) return false;
    const gameState = world.getComponent(targetId, GameState);
    if (!gameState || gameState.state === PlayerStateType.BROKEN) return false;
    if (partKey) {
        const parts = world.getComponent(targetId, Parts);
        if (!parts || !parts[partKey] || parts[partKey].isBroken) {
            return false;
        }
    }
    return true;
}

/**
 * 指定されたエンティティから攻撃可能なパーツをランダムに1つ選択します。
 * @param {World} world
 * @param {number} entityId - ターゲットのエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
export function selectRandomPart(world, entityId) {
    if (!world || entityId === null || entityId === undefined) return null;
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;
    const hittablePartKeys = Object.keys(parts).filter(key => !parts[key].isBroken);
    if (hittablePartKeys.length > 0) {
        const partKey = hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)];
        return { targetId: entityId, targetPartKey: partKey };
    }
    return null;
}

/**
 * 格闘攻撃用に、最もX軸距離の近い敵を見つけます。
 * @param {World} world
 * @param {number} attackerId - 攻撃者のエンティティID
 * @returns {number | null} - 最も近い敵のエンティティID、またはnull
 */
export function findNearestEnemy(world, attackerId) {
    const attackerPos = world.getComponent(attackerId, Position);
    if (!attackerPos) return null;
    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;
    let closestEnemyId = null;
    let minDistance = Infinity;
    for (const enemyId of enemies) {
        const enemyPos = world.getComponent(enemyId, Position);
        if (enemyPos) {
            const distance = Math.abs(attackerPos.x - enemyPos.x);
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemyId = enemyId;
            }
        }
    }
    return closestEnemyId;
}

/**
 * 全ての敵パーツを取得する
 * @param {World} world
 * @param {number[]} enemyIds
 * @returns {{entityId: number, partKey: string, part: object}[]}
 */
export function getAllEnemyParts(world, enemyIds) {
    let allParts = [];
    for (const id of enemyIds) {
        const parts = world.getComponent(id, Parts);
        Object.entries(parts).forEach(([key, part]) => {
            if (!part.isBroken) {
                allParts.push({ entityId: id, partKey: key, part: part });
            }
        });
    }
    return allParts;
}

/**
 * 条件に基づいて最適なパーツを選択するための汎用関数
 * @param {World} world
 * @param {number[]} enemies - 敵エンティティIDの配列
 * @param {function} sortFn - パーツを評価・ソートするための比較関数
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
export function selectPartByCondition(world, enemies, sortFn) {
    const allParts = getAllEnemyParts(world, enemies);
    if (allParts.length === 0) return null;
    allParts.sort(sortFn);
    const selectedPart = allParts[0];
    return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
}
