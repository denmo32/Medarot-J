// scripts/utils/battleUtils.js

import { CONFIG } from '../common/config.js';
// ★追加: Position, PlayerInfo, GameStateをインポート
import { Parts, Position, PlayerInfo, GameState } from '../core/components.js';
// ★追加: PlayerStateTypeをインポート
import { PartType, PlayerStateType } from '../common/constants.js';

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

// --- ★ここから新規/移動した関数 ---

/**
 * ★新規(targetingUtils.jsから移動): 生存している敵エンティティのリストを取得します
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
 * ★新規(targetingStrategies.jsから移動): 指定されたターゲットIDやパーツキーが現在有効（生存・未破壊）か検証します。
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
 * ★新規(targetingStrategies.jsから移動): 指定されたエンティティから攻撃可能なパーツをランダムに1つ選択します。
 * ActionSystemが格闘攻撃のターゲットパーツを決定するために使用します。
 * @param {World} world
 * @param {number} entityId - ターゲットのエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
export function selectRandomPart(world, entityId) {
    if (!world || entityId === null || entityId === undefined) return null;
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;

    // 破壊されていない攻撃可能なパーツのみを候補とします。
    const hittablePartKeys = Object.keys(parts).filter(key => !parts[key].isBroken && key !== PartType.LEGS);

    if (hittablePartKeys.length > 0) {
        const partKey = hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)];
        return { targetId: entityId, targetPartKey: partKey };
    }
    return null; // 攻撃可能なパーツがない場合
}

/**
 * ★新規: 格闘攻撃用に、最もX軸距離の近い敵を見つけます。
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