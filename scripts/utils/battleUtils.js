// scripts/utils/battleUtils.js
import { CONFIG } from '../common/config.js';
import { Parts, Position, PlayerInfo, GameState } from '../core/components.js';
import { PartType, PlayerStateType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';

/**
 * 回避確率を計算する
 * 
 * 公式: (mobility - success) / 200 + 0.10 を 0-0.95 の範囲にクリップ
 * - mobility: ターゲットの機動値
 * - success: 攻撃側の成功値
 * - 計算結果は0から0.95の間の確率を返す
 * 
 * @param {number} mobility - ターゲットの機動値
 * @param {number} success - 攻撃側の成功値
 * @returns {number} 0-0.95の範囲で確率を返す
 */
export function calculateEvasionChance(mobility, success) {
    // 公式: (mobility - success) / 200 + 0.10 を 0-0.95 にクリップ
    const base = (mobility - success) / 200 + 0.10;
    return Math.max(0, Math.min(0.95, base));
}

/**
 * 防御確率を計算する
 * 
 * 公式: armor / 400 + 0.10 を 0-0.95 の範囲にクリップ
 * - armor: ターゲットの防御値
 * - 計算結果は0から0.95の間の確率を返す
 * 
 * @param {number} armor - ターゲットの防御値
 * @returns {number} 0-0.95の範囲で確率を返す
 */
export function calculateDefenseChance(armor) {
    // 公式: armor / 400 + 0.10 を 0-0.95 にクリップ
    const base = armor / 400 + 0.10;
    return Math.max(0, Math.min(0.95, base));
}

/**
 * ダメージを計算する
 * 
 * ダメージ計算式の意味:
 * 1. baseDamage = max(0, 攻撃成功値 - ターゲット機動値 - ターゲット防御値)
 *    - 攻撃側の成功値が高ければ、よりダメージが入りやすくなる
 *    - ターゲットの機動/防御値が高いほど、ダメージが軽減される
 * 2. finalDamage = floor(baseDamage / 4) + 攻撃威力
 *    - baseDamage は4で割ってスケーリングされ、攻撃威力が直接加算される
 *    - これにより、高威力の攻撃がより大きなダメージを与えるようになる
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {number} targetId - ターゲットのエンティティID
 * @param {object} action - 攻撃アクション情報
 * @returns {number} 計算されたダメージ値
 */
export function calculateDamage(world, attackerId, targetId, action) {
    const attackerParts = world.getComponent(attackerId, Parts);
    const attackingPart = attackerParts[action.partKey];
    const targetParts = world.getComponent(targetId, Parts);
    // 攻撃パーツまたはターゲットパーツが見つからない場合は0ダメージ
    if (!attackingPart || !targetParts) {
        return 0;
    }
    // 新しいダメージ計算式に必要なパラメータを取得
    const success = attackingPart.success || 0; // 攻撃側成功度
    const might = attackingPart.might || 0;       // 攻撃側威力度
    const mobility = targetParts.legs.mobility || 0; // ターゲット回避度
    const armor = targetParts.legs.armor || 0;       // ターゲット防御度
    // 新しいダメージ計算式を適用
    // ダメージ = (攻撃側成功度 - ターゲット回避度 - ターゲット防御度) / 4 + 攻撃側威力度
    // ※括弧内の最低値は0とする
    const baseDamage = Math.max(0, success - mobility - armor);
    const finalDamage = Math.floor(baseDamage / 4) + might;
    // デバッグモードが有効な場合のみログを出力
    if (CONFIG.DEBUG) {
        console.log(`--- ダメージ計算 (Attacker: ${attackerId}, Target: ${targetId}) ---`);
        console.log(`  攻撃側: 成功=${success}, 威力=${might}`);
        console.log(`  ターゲット側: 機動=${mobility}, 防御=${armor}`);
        console.log(`  計算過程: Math.floor(Math.max(0, ${success} - ${mobility} - ${armor}) / 4) + ${might} = ${finalDamage}`);
        console.log(`  - ベースダメージ(括弧内): ${baseDamage}`);
        console.log(`  - 最終ダメージ: ${finalDamage}`);
    }
    return finalDamage;
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
    let partTypes = attackableOnly ? [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM, PartType.LEGS] : Object.keys(parts);
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
    const hittablePartKeys = Object.keys(parts).filter(key => !parts[key].isBroken);
    if (hittablePartKeys.length > 0) {
        const partKey = hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)];
        return { targetId: entityId, targetPartKey: partKey };
    }
    return null; // 攻撃可能なパーツがない場合
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

/**
 * ★新規: 選択されたパーツに基づき、適切な行動決定イベントを発行します。
 * この関数は、aiSystemとinputSystemの重複ロジックを共通化するために作成されました。
 * パーツのアクションタイプ（格闘/射撃）を判別し、必要な検証を行った上で、
 * 適切なパラメータと共に `ACTION_SELECTED` イベントを発行します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {string} partKey - 選択されたパーツのキー
 * @param {{targetId: number, targetPartKey: string} | null} target - (射撃の場合) 事前に決定されたターゲット情報
 */
export function decideAndEmitAction(world, entityId, partKey, target = null) {
    const parts = world.getComponent(entityId, Parts);

    // ★追加: 選択されたパーツが無効、または破壊されている場合は行動を中断し、再選択を要求します。
    if (!parts || !parts[partKey] || parts[partKey].isBroken) {
        console.warn(`decideAndEmitAction: Invalid or broken part selected for entity ${entityId}. Re-queueing.`);
        world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
        return;
    }

    const selectedPartAction = parts[partKey].action;

    if (selectedPartAction === '格闘') {
        // 格闘の場合、ターゲットはActionSystemで移動後に決定されるため、ここではnullで発行します。
        world.emit(GameEvents.ACTION_SELECTED, { 
            entityId, 
            partKey, 
            targetId: null, 
            targetPartKey: null 
        });
    } else { // '射撃'
        // 射撃の場合、有効なターゲットが必須です。ターゲットが無効な場合は再選択を要求します。
        if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
             console.warn(`decideAndEmitAction: Invalid or missing target for shooting action by ${entityId}. Re-queueing.`);
             world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
             return;
        }
        world.emit(GameEvents.ACTION_SELECTED, { 
            entityId, 
            partKey, 
            targetId: target.targetId, 
            targetPartKey: target.targetPartKey 
        });
    }
}
