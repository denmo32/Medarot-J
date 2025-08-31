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
// 複数のシステムから利用されるため、汎用的なユーティリティとしてここに集約します。

/**
 * 攻撃者のメダルの性格に基づき、ターゲット（敵エンティティとパーツ）を決定します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    const attackerMedal = world.getComponent(attackerId, Medal);
    const attackerLog = world.getComponent(attackerId, BattleLog);
    // GameContextはシングルトンなので、world経由で取得します
    const context = world.getSingletonComponent(GameContext);

    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;

    let targetId = null;
    let targetPartKey = null;

    // 性格に基づいてターゲットを決定
    switch (attackerMedal.personality) {
        case MedalPersonality.HUNTER:
        case MedalPersonality.CRUSHER: {
            const allParts = getAllEnemyParts(world, enemies);
            if (allParts.length === 0) break;
            allParts.sort((a, b) => a.part.hp - b.part.hp); // HPで昇順ソート
            const targetPartInfo = attackerMedal.personality === MedalPersonality.HUNTER ? allParts[0] : allParts[allParts.length - 1];
            targetId = targetPartInfo.entityId;
            targetPartKey = targetPartInfo.partKey;
            break;
        }
        case MedalPersonality.JOKER: {
             const allParts = getAllEnemyParts(world, enemies);
             if (allParts.length === 0) break;
             const randomPart = allParts[Math.floor(Math.random() * allParts.length)];
             targetId = randomPart.entityId;
             targetPartKey = randomPart.partKey;
             break;
        }
        case MedalPersonality.COUNTER: {
            const lastAttackerId = attackerLog.lastAttackedBy;
            if (isValidTarget(world, lastAttackerId)) {
                targetId = lastAttackerId;
            }
            break;
        }
        case MedalPersonality.GUARD: {
            const leaderLastAttackerId = context.leaderLastAttackedBy[attackerInfo.teamId];
            if (isValidTarget(world, leaderLastAttackerId)) {
                targetId = leaderLastAttackerId;
            }
            break;
        }
        case MedalPersonality.FOCUS: {
            const lastAttack = attackerLog.lastAttack;
            if (isValidTarget(world, lastAttack.targetId, lastAttack.partKey)) {
                targetId = lastAttack.targetId;
                targetPartKey = lastAttack.partKey;
            }
            break;
        }
        case MedalPersonality.ASSIST: {
            const teamLastAttack = context.teamLastAttack[attackerInfo.teamId];
            if (isValidTarget(world, teamLastAttack.targetId, teamLastAttack.partKey)) {
                targetId = teamLastAttack.targetId;
                targetPartKey = teamLastAttack.partKey;
            }
            break;
        }
        case MedalPersonality.LEADER_FOCUS: {
            const leader = enemies.find(id => world.getComponent(id, PlayerInfo).isLeader);
            if (isValidTarget(world, leader)) {
                targetId = leader;
            }
            break;
        }
        case MedalPersonality.RANDOM:
        default:
            // デフォルトの動作（ランダムな敵）
            break;
    }

    // フォールバック処理: ターゲットエンティティが決まらなかった場合、ランダムな敵を選択します。
    if (!isValidTarget(world, targetId)) {
        targetId = enemies[Math.floor(Math.random() * enemies.length)];
    }

    // フォールバック処理: ターゲットパーツが決まっていない、または無効な場合、有効なパーツからランダムに選択します。
    if (!targetPartKey || !isValidTarget(world, targetId, targetPartKey)) {
        const availableParts = getAvailableParts(world, targetId);
        if (availableParts.length > 0) {
            targetPartKey = availableParts[Math.floor(Math.random() * availableParts.length)];
        } else {
            // 選択したターゲットに攻撃可能なパーツがない場合、ターゲット選択からやり直すか、行動をスキップします。
            // ここでは簡単のため、一旦nullを返して行動をスキップさせます。
            // TODO: 攻撃可能なパーツを持つ別の敵を探すロジックも検討可能です。
            return null;
        }
    }
    
    return { targetId, targetPartKey };
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