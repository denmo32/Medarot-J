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

    // ★変更: 性格に対応する戦略関数を取得。各戦略は自己完結しているため、この関数は単なる呼び出し窓口(ファサード)になります。
    const strategy = targetingStrategies[attackerMedal.personality] || targetingStrategies.RANDOM;
    let target = strategy(world, attackerId, enemies);

    // ★変更: 戦略が見つけられなかった場合のフォールバック処理を簡素化。
    // 各戦略関数は、ターゲットが見つからない場合に、内部でRANDOM戦略を呼び出すかnullを返す責務を負います。
    // ここでは、最終的にターゲットが見つからなかった場合のみ、安全策としてRANDOM戦略を呼び出します。
    // ★改善: フォールバック処理をここに集約。各戦略はターゲットが見つからない場合nullを返すことに専念する。
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        // ターゲットが見つからない、または無効な場合は、デフォルトのRANDOM戦略で再決定する
        target = targetingStrategies.RANDOM(world, attackerId, enemies);
    }
    
    return target;
}

// --- 性格別ターゲット決定戦略 ---

// ★変更: 各戦略が自己完結するように修正。
// ターゲットエンティティとターゲットパーツの両方を決定して返すか、nullを返すように責務を明確化。
const targetingStrategies = {
    // [HUNTER]: 最もHPが低いパーツを狙う
    [MedalPersonality.HUNTER]: (world, attackerId, enemies) => {
        const allParts = getAllEnemyParts(world, enemies);
        if (allParts.length === 0) return null;
        allParts.sort((a, b) => a.part.hp - b.part.hp); // HPで昇順ソート
        const targetPartInfo = allParts[0];
        return { targetId: targetPartInfo.entityId, targetPartKey: targetPartInfo.partKey };
    },

    // [CRUSHER]: 最もHPが高いパーツを狙う
    [MedalPersonality.CRUSHER]: (world, attackerId, enemies) => {
        const allParts = getAllEnemyParts(world, enemies);
        if (allParts.length === 0) return null;
        allParts.sort((a, b) => b.part.hp - a.part.hp); // HPで降順ソート
        const targetPartInfo = allParts[0];
        return { targetId: targetPartInfo.entityId, targetPartKey: targetPartInfo.partKey };
    },

    // [JOKER]: 敵全体のパーツからランダムに1つを狙う
    [MedalPersonality.JOKER]: (world, attackerId, enemies) => {
        const allParts = getAllEnemyParts(world, enemies);
        if (allParts.length === 0) return null;
        const randomPart = allParts[Math.floor(Math.random() * allParts.length)];
        return { targetId: randomPart.entityId, targetPartKey: randomPart.partKey };
    },

    // [COUNTER]: 自分を最後に攻撃した敵を狙う。いなければnull。
    [MedalPersonality.COUNTER]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        // ★改善: ターゲットが有効な場合のみパーツを選択。無効ならフォールバックせずnullを返す。
        if (isValidTarget(world, targetId)) {
            return selectRandomPart(world, targetId);
        }
        return null;
    },

    // [GUARD]: 味方リーダーを最後に攻撃した敵を狙う。いなければnull。
    [MedalPersonality.GUARD]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const targetId = context.leaderLastAttackedBy[attackerInfo.teamId];
        // ★改善: ターゲットが有効な場合のみパーツを選択。無効ならフォールバックせずnullを返す。
        if (isValidTarget(world, targetId)) {
            return selectRandomPart(world, targetId);
        }
        return null;
    },

    // [FOCUS]: 自分が最後に攻撃したパーツを狙う。なければnull。
    [MedalPersonality.FOCUS]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        // ★改善: ターゲットが有効な場合のみパーツを選択。無効ならフォールバックせずnullを返す。
        if (isValidTarget(world, lastAttack.targetId, lastAttack.partKey)) {
            // ★修正: プロパティ名を `targetPartKey` に統一して返す
            return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
        }
        return null;
    },

    // [ASSIST]: 味方が最後に攻撃したパーツを狙う。なければnull。
    [MedalPersonality.ASSIST]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const teamLastAttack = context.teamLastAttack[attackerInfo.teamId];
        // ★改善: ターゲットが有効な場合のみパーツを選択。無効ならフォールバックせずnullを返す。
        if (isValidTarget(world, teamLastAttack.targetId, teamLastAttack.partKey)) {
            // ★修正: プロパティ名を `targetPartKey` に統一して返す
            return { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey };
        }
        return null;
    },

    // [LEADER_FOCUS]: 敵リーダーを狙う。いなければnull。
    [MedalPersonality.LEADER_FOCUS]: (world, attackerId, enemies) => {
        const leader = enemies.find(id => world.getComponent(id, PlayerInfo).isLeader);
        // ★改善: ターゲットが有効な場合のみパーツを選択。無効ならフォールバックせずnullを返す。
        if (isValidTarget(world, leader)) {
            return selectRandomPart(world, leader);
        }
        return null;
    },

    // [RANDOM]: 敵1体をランダムに選び、そのパーツをランダムに狙う
    [MedalPersonality.RANDOM]: (world, attackerId, enemies) => {
        if (enemies.length === 0) return null;
        const targetId = enemies[Math.floor(Math.random() * enemies.length)];
        return selectRandomPart(world, targetId);
    }
};

/** 
 * ★新規: 指定されたエンティティから攻撃可能なパーツをランダムに1つ選択するヘルパー関数
 * @param {World} world
 * @param {number} entityId - ターゲットのエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
function selectRandomPart(world, entityId) {
    // ★変更: getAttackableParts を使用するように統一
    const attackableParts = getAttackableParts(world, entityId);
    if (attackableParts.length > 0) {
        // getAttackablePartsは [[key, part], ...] の形式で返すため、[0]でキーを取得
        const partKey = attackableParts[Math.floor(Math.random() * attackableParts.length)][0];
        return { targetId: entityId, targetPartKey: partKey };
    }
    return null; // 攻撃可能なパーツがない
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
 * ★削除: getAvailablePartsはgetAttackablePartsと機能が重複するため削除されました。
 */

/**
 * 指定されたエンティティの、破壊されていない「攻撃用」パーツのリストを取得します。
 * DecisionSystemの重複コードを共通化するために作成されました。
 * ★変更: プロジェクト全体でこの関数に統一されました。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - エンティティID
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getAttackableParts(world, entityId) {
    // ★追加: ターゲットが存在しない場合に空配列を返すガード節
    if (entityId === null || entityId === undefined) return [];
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return [];

    // 攻撃に使用できるパーツ種別
    const attackablePartTypes = [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM];

    return Object.entries(parts)
        .filter(([key, part]) => !part.isBroken && attackablePartTypes.includes(key));
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