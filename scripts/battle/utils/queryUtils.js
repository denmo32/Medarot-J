/**
 * @file クエリユーティリティ
 * ワールド（ECS）から特定の条件に基づいてエンティティやコンポーネントを
 * 問い合わせる（検索・取得する）ためのユーティリティ関数群です。
 */

import { Parts, Position, PlayerInfo, GameState, ActiveEffects } from '../core/components/index.js';
import { PartInfo, PlayerStateType, EffectType } from '../common/constants.js';

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
    // ★追加: そもそも頭部が壊れていたら攻撃可能パーツは無い
    const parts = world.getComponent(entityId, Parts);
    if (parts?.head?.isBroken) {
        return [];
    }
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
    if (!attackerInfo) return [];
    return world.getEntitiesWith(PlayerInfo, Parts) // ★ GameStateの代わりにPartsを取得
        .filter(id => {
            const pInfo = world.getComponent(id, PlayerInfo);
            const parts = world.getComponent(id, Parts); // ★ Partsを取得
            // ★修正: GameStateではなく、頭部パーツの破壊状態で生存を判定
            return id !== attackerId && pInfo.teamId !== attackerInfo.teamId && !parts.head?.isBroken;
        });
}

/**
 * ★新規: 生存している味方エンティティのリストを取得します
 * @param {World} world
 * @param {number} sourceId - 基準となるエンティティID
 * @param {boolean} [includeSelf=false] - 結果に自分自身を含めるか
 * @returns {number[]}
 */
export function getValidAllies(world, sourceId, includeSelf = false) {
    const sourceInfo = world.getComponent(sourceId, PlayerInfo);
    if (!sourceInfo) return [];
    return world.getEntitiesWith(PlayerInfo, Parts) // ★ GameStateの代わりにPartsを取得
        .filter(id => {
            if (!includeSelf && id === sourceId) return false;
            const pInfo = world.getComponent(id, PlayerInfo);
            const parts = world.getComponent(id, Parts); // ★ Partsを取得
            // ★修正: GameStateではなく、頭部パーツの破壊状態で生存を判定
            return pInfo.teamId === sourceInfo.teamId && !parts.head?.isBroken;
        });
}

/**
 * ★新規: 味方チーム内で最も損害を受けているパーツを検索します。
 * HEALER戦略や回復アクションのターゲット決定に利用されます。
 * @param {World} world - ワールドオブジェクト
 * @param {number[]} candidates - 検索対象となるエンティティIDの配列
 * @returns {{targetId: number, targetPartKey: string} | null} - 最も損害の大きいパーツを持つターゲット情報、またはnull
 */
export function findMostDamagedAllyPart(world, candidates) {
    if (!candidates || candidates.length === 0) return null;

    let mostDamagedPart = null;
    let maxDamage = -1;

    candidates.forEach(allyId => {
        const parts = world.getComponent(allyId, Parts);
        if (!parts) return;
        Object.entries(parts).forEach(([partKey, part]) => {
            if (part && !part.isBroken) {
                const damageTaken = part.maxHp - part.hp;
                if (damageTaken > maxDamage) {
                    maxDamage = damageTaken;
                    mostDamagedPart = { targetId: allyId, targetPartKey: partKey };
                }
            }
        });
    });
    
    // 誰もダメージを受けていない場合はターゲットなし
    if (maxDamage <= 0) return null;

    return mostDamagedPart;
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
    // ★修正: GameStateではなくPartsコンポーネントで生存確認
    const parts = world.getComponent(targetId, Parts);
    if (!parts || parts.head?.isBroken) return false;

    if (partKey) {
        if (!parts[partKey] || parts[partKey].isBroken) {
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
    if (!parts || parts.head?.isBroken) return null; // ★追加: 機能停止チェック
    const hittablePartKeys = Object.keys(parts).filter(key => parts[key] && !parts[key].isBroken);
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
 * ★変更: 指定された候補エンティティリストから、破壊されていない全パーツを取得する
 * (旧: getAllEnemyParts)
 * @param {World} world
 * @param {number[]} candidateIds - 候補エンティティIDの配列
 * @returns {{entityId: number, partKey: string, part: object}[]}
 */
export function getAllPartsFromCandidates(world, candidateIds) {
    let allParts = [];
    if (!candidateIds) return []; // 候補がいない場合は空配列を返す
    for (const id of candidateIds) {
        const parts = world.getComponent(id, Parts);
        if (!parts || parts.head?.isBroken) continue; // ★追加: 機能停止した機体のパーツは含めない
        Object.entries(parts).forEach(([key, part]) => {
            if (part && !part.isBroken) {
                allParts.push({ entityId: id, partKey: key, part: part });
            }
        });
    }
    return allParts;
}

/**
 * 条件に基づいて最適なパーツを選択するための汎用関数
 * @param {World} world
 * @param {number[]} candidates - 候補エンティティIDの配列
 * @param {function} sortFn - パーツを評価・ソートするための比較関数
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
export function selectPartByCondition(world, candidates, sortFn) {
    // ★変更: getAllEnemyParts -> getAllPartsFromCandidates
    const allParts = getAllPartsFromCandidates(world, candidates);
    if (allParts.length === 0) return null;
    allParts.sort(sortFn);
    const selectedPart = allParts[0];
    return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
}

/**
 * @function findGuardian
 * @description 指定されたターゲットのチームから、ガード状態の機体を探します。
 * 複数いる場合は、ガードパーツのHPが最も高い機体を返します。
 * (ActionSystemから移管)
 * @param {World} world - ワールドオブジェクト
 * @param {number} originalTargetId - 本来の攻撃ターゲットのエンティティID
 * @returns {{id: number, partKey: string, name: string} | null} ガード役の情報、またはnull
 */
export function findGuardian(world, originalTargetId) {
    const targetInfo = world.getComponent(originalTargetId, PlayerInfo);
    if (!targetInfo) return null;

    const potentialGuardians = world.getEntitiesWith(PlayerInfo, ActiveEffects, Parts)
        .filter(id => {
            if (id === originalTargetId) return false;
            const info = world.getComponent(id, PlayerInfo);
            const parts = world.getComponent(id, Parts);
            const activeEffects = world.getComponent(id, ActiveEffects);
            // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
            // ★修正: ガード回数が1回以上残っていることを条件に追加
            const hasGuardEffect = activeEffects?.effects.some(e => e.type === EffectType.APPLY_GUARD && e.count > 0);
            // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---
            
            return info.teamId === targetInfo.teamId && !parts.head?.isBroken && hasGuardEffect;
        })
        .map(id => {
            const activeEffects = world.getComponent(id, ActiveEffects);
            const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
            const parts = world.getComponent(id, Parts);
            const info = world.getComponent(id, PlayerInfo);

            if (guardEffect && parts[guardEffect.partKey] && !parts[guardEffect.partKey].isBroken) {
                return {
                    id: id,
                    partKey: guardEffect.partKey,
                    partHp: parts[guardEffect.partKey].hp,
                    name: info.name,
                };
            }
            return null;
        })
        .filter(g => g !== null);

    if (potentialGuardians.length === 0) return null;

    potentialGuardians.sort((a, b) => b.partHp - a.partHp);
    
    return potentialGuardians[0];
}