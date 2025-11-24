/**
 * @file クエリユーティリティ
 * ワールド（ECS）から特定の条件に基づいてエンティティやコンポーネントを
 * 問い合わせる（検索・取得する）ためのユーティリティ関数群です。
 * 宣言的な記述（filter, map, reduce等）を用いて可読性を高めています。
 */

import { Parts, Position, PlayerInfo, GameState, ActiveEffects } from '../components/index.js';
import { PartInfo, PlayerStateType, EffectType, EffectScope } from '../common/constants.js';

/**
 * 2つのエンティティを脚部パーツの「推進」の値で比較するためのソート関数を生成する高階関数。
 * @param {World} world - ワールドオブジェクト
 * @returns {function(number, number): number} - Array.sort() に渡せる比較関数
 */
export const compareByPropulsion = (world) => (entityA, entityB) => {
    const partsA = world.getComponent(entityA, Parts);
    const partsB = world.getComponent(entityB, Parts);

    const propulsionA = partsA?.legs?.propulsion || 0;
    const propulsionB = partsB?.legs?.propulsion || 0;

    // 推進力が高い順（降順）にソート
    return propulsionB - propulsionA;
};

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
    
    // フィルタリング条件の定義
    const isTargetType = (key) => !attackableOnly || attackablePartKeys.includes(key);
    const isAlive = (part) => includeBroken || !part.isBroken;

    return Object.entries(parts)
        .filter(([key, part]) => part && isTargetType(key) && isAlive(part));
}

/**
 * 指定されたエンティティの、破壊されていない「攻撃用」パーツのリストを取得します。
 * @param {World} world
 * @param {number} entityId
 * @returns {[string, object][]} - [パーツキー, パーツオブジェクト]の配列
 */
export function getAttackableParts(world, entityId) {
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
        .filter(([key, part]) => key !== PartInfo.HEAD.key && !part.isBroken)
        .sort(([, a], [, b]) => b.hp - a.hp);

    return defendableParts.length > 0 ? defendableParts[0][0] : null;
}

/**
 * チームIDと条件に基づいて、生存しているエンティティのリストを取得する内部ヘルパー関数。
 * @param {World} world
 * @param {string} sourceTeamId - 基準となるチームID
 * @param {boolean} isAlly - 味方を検索する場合はtrue, 敵を検索する場合はfalse
 * @returns {number[]}
 * @private
 */
const _getValidEntitiesByTeam = (world, sourceTeamId, isAlly) => {
    return world.getEntitiesWith(PlayerInfo, Parts)
        .filter(id => {
            const pInfo = world.getComponent(id, PlayerInfo);
            const parts = world.getComponent(id, Parts);
            const isSameTeam = pInfo.teamId === sourceTeamId;
            const isAlive = !parts.head?.isBroken;
            
            return (isAlly ? isSameTeam : !isSameTeam) && isAlive;
        });
};

/**
 * 生存している敵エンティティのリストを取得します
 * @param {World} world
 * @param {number} attackerId
 * @returns {number[]}
 */
export function getValidEnemies(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    if (!attackerInfo) return [];
    return _getValidEntitiesByTeam(world, attackerInfo.teamId, false);
}

/**
 * 生存している味方エンティティのリストを取得します
 * @param {World} world
 * @param {number} sourceId - 基準となるエンティティID
 * @param {boolean} [includeSelf=false] - 結果に自分自身を含めるか
 * @returns {number[]}
 */
export function getValidAllies(world, sourceId, includeSelf = false) {
    const sourceInfo = world.getComponent(sourceId, PlayerInfo);
    if (!sourceInfo) return [];
    const allies = _getValidEntitiesByTeam(world, sourceInfo.teamId, true);
    return includeSelf ? allies : allies.filter(id => id !== sourceId);
}

/**
 * 指定された`targetScope`に基づいて、適切なターゲット候補のエンティティリストを返します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {string} scope - ターゲットの範囲 (EffectScope定数)
 * @returns {number[]} ターゲット候補のエンティティIDの配列
 */
export function getCandidatesByScope(world, entityId, scope) {
    switch (scope) {
        case EffectScope.ENEMY_SINGLE:
        case EffectScope.ENEMY_TEAM:
            return getValidEnemies(world, entityId);
        case EffectScope.ALLY_SINGLE:
            return getValidAllies(world, entityId, false);
        case EffectScope.ALLY_TEAM:
            return getValidAllies(world, entityId, true);
        case EffectScope.SELF:
            return [entityId];
        default:
            console.warn(`getCandidatesByScope: Unknown targetScope '${scope}'. Defaulting to enemies.`);
            return getValidEnemies(world, entityId);
    }
}

/**
 * 味方チーム内で最も損害を受けているパーツを検索します。
 * @param {World} world - ワールドオブジェクト
 * @param {number[]} candidates - 検索対象となるエンティティIDの配列
 * @returns {{targetId: number, targetPartKey: string} | null} - 最も損害の大きいパーツを持つターゲット情報、またはnull
 */
export function findMostDamagedAllyPart(world, candidates) {
    if (!candidates || candidates.length === 0) return null;

    // 全候補の全パーツをフラットに展開し、ダメージ順にソートして先頭を取得するアプローチ
    // (計算量は増えるが可読性は高い)
    const damagedParts = candidates.flatMap(allyId => {
        const parts = world.getComponent(allyId, Parts);
        if (!parts) return [];
        
        return Object.entries(parts)
            .filter(([_, part]) => part && !part.isBroken && part.maxHp > part.hp)
            .map(([key, part]) => ({
                targetId: allyId,
                targetPartKey: key,
                damage: part.maxHp - part.hp
            }));
    });

    if (damagedParts.length === 0) return null;

    // 最もダメージが大きい順にソート
    damagedParts.sort((a, b) => b.damage - a.damage);
    
    return { targetId: damagedParts[0].targetId, targetPartKey: damagedParts[0].targetPartKey };
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
    if (!parts || parts.head?.isBroken) return null;

    const hittablePartKeys = Object.keys(parts).filter(key => parts[key] && !parts[key].isBroken);
    if (hittablePartKeys.length === 0) return null;

    const partKey = hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)];
    return { targetId: entityId, targetPartKey: partKey };
}

/**
 * 貫通ダメージの対象となる、ランダムな未破壊パーツを選択します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - ターゲットのエンティティID
 * @param {string} excludedPartKey - 貫通元となった、既に破壊されたパーツのキー
 * @returns {string | null} 貫通対象のパーツキー、またはnull
 */
export function findRandomPenetrationTarget(world, entityId, excludedPartKey) {
    if (!world || entityId === null || entityId === undefined) return null;
    const parts = world.getComponent(entityId, Parts);
    if (!parts || parts.head?.isBroken) return null;

    const hittablePartKeys = Object.keys(parts).filter(key => 
        key !== excludedPartKey && parts[key] && !parts[key].isBroken
    );

    return hittablePartKeys.length > 0 
        ? hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)] 
        : null;
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

    // 距離計算とソート
    const enemiesWithDistance = enemies
        .map(id => {
            const pos = world.getComponent(id, Position);
            return pos ? { id, distance: Math.abs(attackerPos.x - pos.x) } : null;
        })
        .filter(item => item !== null)
        .sort((a, b) => a.distance - b.distance);

    return enemiesWithDistance.length > 0 ? enemiesWithDistance[0].id : null;
}

/**
 * 指定された候補エンティティリストから、破壊されていない全パーツを取得する
 * @param {World} world
 * @param {number[]} candidateIds - 候補エンティティIDの配列
 * @returns {{entityId: number, partKey: string, part: object}[]}
 */
export function getAllPartsFromCandidates(world, candidateIds) {
    if (!candidateIds) return [];
    
    return candidateIds.flatMap(id => {
        const parts = world.getComponent(id, Parts);
        if (!parts || parts.head?.isBroken) return [];
        
        return Object.entries(parts)
            .filter(([_, part]) => part && !part.isBroken)
            .map(([key, part]) => ({ entityId: id, partKey: key, part }));
    });
}

/**
 * 条件に基づいて最適なパーツを選択するための汎用関数
 * @param {World} world
 * @param {number[]} candidates - 候補エンティティIDの配列
 * @param {function} sortFn - パーツを評価・ソートするための比較関数
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
export function selectPartByCondition(world, candidates, sortFn) {
    const allParts = getAllPartsFromCandidates(world, candidates);
    if (allParts.length === 0) return null;
    
    allParts.sort(sortFn);
    const selectedPart = allParts[0];
    return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
}

/**
 * 重み付けされたアイテムのリストから、確率に基づいてアイテムを1つ選択します。
 * @param {Array<object>} weightedItems - `weight`プロパティを持つオブジェクトの配列
 * @returns {object | null} 選択されたアイテム、またはnull
 */
export function selectItemByProbability(weightedItems) {
    if (!weightedItems || weightedItems.length === 0) return null;

    const totalWeight = weightedItems.reduce((sum, item) => sum + (item.weight || 0), 0);
    if (totalWeight === 0) return weightedItems[0];

    const randomValue = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    // findメソッドを使うと簡潔だが、累積計算が必要なためfor...ofを使用
    for (const item of weightedItems) {
        cumulativeWeight += (item.weight || 0);
        if (randomValue < cumulativeWeight) {
            return item;
        }
    }
    return weightedItems[0];
}

/**
 * 指定されたターゲットのチームから、ガード状態の機体を探します。
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
            
            const isSameTeam = info.teamId === targetInfo.teamId;
            const isAlive = !parts.head?.isBroken;
            const hasGuardEffect = activeEffects?.effects.some(e => e.type === EffectType.APPLY_GUARD && e.count > 0);
            
            return isSameTeam && isAlive && hasGuardEffect;
        })
        .map(id => {
            const activeEffects = world.getComponent(id, ActiveEffects);
            const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
            const parts = world.getComponent(id, Parts);
            const info = world.getComponent(id, PlayerInfo);
            const guardPart = parts[guardEffect.partKey];

            if (guardPart && !guardPart.isBroken) {
                return {
                    id: id,
                    partKey: guardEffect.partKey,
                    partHp: guardPart.hp,
                    name: info.name,
                };
            }
            return null;
        })
        .filter(g => g !== null);

    if (potentialGuardians.length === 0) return null;
    
    // ガードパーツのHPが高い順にソートして最強のガード役を返す
    potentialGuardians.sort((a, b) => b.partHp - a.partHp);
    return potentialGuardians[0];
}
