// scripts/battleUtils.js:

// import文をファイル先頭に集約し、重複を解消します。
import { CONFIG } from './config.js';
import { Parts, PlayerInfo, GameState, Medal, BattleLog, GameContext } from './components.js';
import { PartType, PlayerStateType, MedalPersonality } from './constants.js';

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

// --- ターゲット決定ロジックとヘルパー関数群 ---

/**
 * 攻撃者のメダルの性格に基づき、ターゲット（敵エンティティとパーツ）を決定します。
 * 性格ごとの戦略関数を呼び出すファサードとして機能します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId) {
    const attackerMedal = world.getComponent(attackerId, Medal);
    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;

    let target = null;

    // 性格に基づいて戦略を選択
    switch (attackerMedal.personality) {
        case MedalPersonality.HUNTER:
            target = _getTargetForHunter(world, enemies);
            break;
        case MedalPersonality.CRUSHER:
            target = _getTargetForCrusher(world, enemies);
            break;
        case MedalPersonality.JOKER:
            target = _getTargetForJoker(world, enemies);
            break;
        case MedalPersonality.COUNTER:
            target = _getTargetForCounter(world, attackerId);
            break;
        case MedalPersonality.GUARD:
            target = _getTargetForGuard(world, attackerId);
            break;
        case MedalPersonality.FOCUS:
            target = _getTargetForFocus(world, attackerId);
            break;
        case MedalPersonality.ASSIST:
            target = _getTargetForAssist(world, attackerId);
            break;
        case MedalPersonality.LEADER_FOCUS:
            target = _getTargetForLeaderFocus(world, enemies);
            break;
        case MedalPersonality.RANDOM:
        default:
            // デフォルトの動作はランダム
            target = _getTargetRandomly(world, enemies);
            break;
    }

    // 戦略によってターゲットが見つからなかった場合、または無効な場合のフォールバック
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        target = _getTargetRandomly(world, enemies);
    }
    
    // それでも見つからなければ諦める
    if (!target) return null;

    // ターゲットエンティティは決まったが、パーツが決まっていない場合のフォールバック
    if (!target.targetPartKey) {
        const availableParts = getAvailableParts(world, target.targetId);
        if (availableParts.length > 0) {
            target.targetPartKey = availableParts[Math.floor(Math.random() * availableParts.length)];
        } else {
            // 攻撃可能なパーツがない場合は行動不可
            return null;
        }
    }

    return target;
}

// --- 性格別ターゲット決定戦略 ---
// determineTargetから呼び出される、より具体的な戦略関数群です。

function _getTargetForHunter(world, enemies) {
    const allParts = getAllEnemyParts(world, enemies);
    if (allParts.length === 0) return null;
    allParts.sort((a, b) => a.part.hp - b.part.hp); // HPで昇順ソート
    const targetPartInfo = allParts[0];
    return { entityId: targetPartInfo.entityId, targetPartKey: targetPartInfo.partKey };
}

function _getTargetForCrusher(world, enemies) {
    const allParts = getAllEnemyParts(world, enemies);
    if (allParts.length === 0) return null;
    allParts.sort((a, b) => b.part.hp - a.part.hp); // HPで降順ソート
    const targetPartInfo = allParts[0];
    return { entityId: targetPartInfo.entityId, targetPartKey: targetPartInfo.partKey };
}

function _getTargetForJoker(world, enemies) {
    const allParts = getAllEnemyParts(world, enemies);
    if (allParts.length === 0) return null;
    const randomPart = allParts[Math.floor(Math.random() * allParts.length)];
    return { entityId: randomPart.entityId, targetPartKey: randomPart.partKey };
}

function _getTargetForCounter(world, attackerId) {
    const attackerLog = world.getComponent(attackerId, BattleLog);
    const lastAttackerId = attackerLog.lastAttackedBy;
    return isValidTarget(world, lastAttackerId) ? { targetId: lastAttackerId, targetPartKey: null } : null;
}

function _getTargetForGuard(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    const context = world.getSingletonComponent(GameContext);
    const leaderLastAttackerId = context.leaderLastAttackedBy[attackerInfo.teamId];
    return isValidTarget(world, leaderLastAttackerId) ? { targetId: leaderLastAttackerId, targetPartKey: null } : null;
}

function _getTargetForFocus(world, attackerId) {
    const attackerLog = world.getComponent(attackerId, BattleLog);
    const lastAttack = attackerLog.lastAttack;
    return isValidTarget(world, lastAttack.targetId, lastAttack.partKey) ? { ...lastAttack } : null;
}

function _getTargetForAssist(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    const context = world.getSingletonComponent(GameContext);
    const teamLastAttack = context.teamLastAttack[attackerInfo.teamId];
    return isValidTarget(world, teamLastAttack.targetId, teamLastAttack.partKey) ? { ...teamLastAttack } : null;
}

function _getTargetForLeaderFocus(world, enemies) {
    const leader = enemies.find(id => world.getComponent(id, PlayerInfo).isLeader);
    return isValidTarget(world, leader) ? { targetId: leader, targetPartKey: null } : null;
}

function _getTargetRandomly(world, enemies) {
    if (enemies.length === 0) return null;
    const targetId = enemies[Math.floor(Math.random() * enemies.length)];
    // パーツは後続のフォールバックで決定されるため、ここではnullを返す
    return { targetId, targetPartKey: null };
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
 * 指定された敵たちの、破壊されていない全パーツのリストを取得します 
 * @param {World} world
 * @param {number[]} enemyIds
 * @returns {{entityId: number, partKey: string, part: object}[]}
 */
export function getAllEnemyParts(world, enemyIds) {
    let allParts = [];
    for (const id of enemyIds) {
        const parts = world.getComponent(id, Parts);
        Object.entries(parts).forEach(([key, part]) => {
            if (!part.isBroken && key !== PartType.LEGS) {
                allParts.push({ entityId: id, partKey: key, part: part });
            }
        });
    }
    return allParts;
}

/** 
 * 指定されたエンティティの、破壊されていない攻撃可能パーツキーのリストを取得します 
 * @param {World} world
 * @param {number} entityId
 * @returns {string[]}
 */
export function getAvailableParts(world, entityId) {
    if (entityId === null || entityId === undefined) return [];
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return [];
    // 脚部パーツは攻撃に使えないため除外
    return Object.keys(parts).filter(key => !parts[key].isBroken && key !== PartType.LEGS);
}

/** 
 * 指定されたターゲットIDやパーツキーが現在有効（生存・未破壊）か検証します 
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