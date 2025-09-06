// scripts/ai/targetingStrategies.js

import { CONFIG } from '../config.js';
import { Parts, PlayerInfo, GameState, Medal, BattleLog, GameContext } from '../components.js';
import { PartType, PlayerStateType, MedalPersonality } from '../constants.js';

/**
 * メダルの性格に基づくターゲット決定戦略
 * 各戦略はターゲットエンティティとパーツを決定して返す
 */
export const targetingStrategies = {
    // [HUNTER]: 最もHPが低いパーツを狙う
    [MedalPersonality.HUNTER]: (world, attackerId, enemies) => {
        return selectPartByCondition(world, enemies, (a, b) => a.part.hp - b.part.hp);
    },

    // [CRUSHER]: 最もHPが高いパーツを狙う
    [MedalPersonality.CRUSHER]: (world, attackerId, enemies) => {
        return selectPartByCondition(world, enemies, (a, b) => b.part.hp - a.part.hp);
    },

    // [JOKER]: 敵全体のパーツからランダムに1つを狙う
    [MedalPersonality.JOKER]: (world, attackerId, enemies) => {
        const allParts = getAllEnemyParts(world, enemies);
        if (allParts.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * allParts.length);
        return { targetId: allParts[randomIndex].entityId, targetPartKey: allParts[randomIndex].partKey };
    },

    // [COUNTER]: 自分を最後に攻撃した敵を狙う。いなければnull。
    [MedalPersonality.COUNTER]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const targetId = attackerLog.lastAttackedBy;
        // ターゲットが有効な場合のみパーツを選択。無効ならnullを返す。
        if (isValidTarget(world, targetId)) {
            return selectRandomPart(world, targetId);
        }
        return null;
    },

    // [GUARD]: 味方リーダーを最後に攻撃した敵を狙う。いなければnull。
    [MedalPersonality.GARD]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const targetId = context.leaderLastAttackedBy[attackerInfo.teamId];
        // ターゲットが有効な場合のみパーツを選択。無効ならnullを返す。
        if (isValidTarget(world, targetId)) {
            return selectRandomPart(world, targetId);
        }
        return null;
    },

    // [FOCUS]: 自分が最後に攻撃したパーツを狙う。なければnull。
    [MedalPersonality.FOCUS]: (world, attackerId, enemies) => {
        const attackerLog = world.getComponent(attackerId, BattleLog);
        const lastAttack = attackerLog.lastAttack;
        // ターゲットが有効な場合のみパーツを選択。無効ならnullを返す。
        if (isValidTarget(world, lastAttack.targetId, lastAttack.partKey)) {
            return { targetId: lastAttack.targetId, targetPartKey: lastAttack.partKey };
        }
        return null;
    },

    // [ASSIST]: 味方が最後に攻撃したパーツを狙う。なければnull。
    [MedalPersonality.ASSIST]: (world, attackerId, enemies) => {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const context = world.getSingletonComponent(GameContext);
        const teamLastAttack = context.teamLastAttack[attackerInfo.teamId];
        // ターゲットが有効な場合のみパーツを選択。無効ならnullを返す。
        if (isValidTarget(world, teamLastAttack.targetId, teamLastAttack.partKey)) {
            return { targetId: teamLastAttack.targetId, targetPartKey: teamLastAttack.partKey };
        }
        return null;
    },

    // [LEADER_FOCUS]: 敵リーダーを狙う。いなければnull。
    [MedalPersonality.LEADER_FOCUS]: (world, attackerId, enemies) => {
        const leader = enemies.find(id => world.getComponent(id, PlayerInfo).isLeader);
        // ターゲットが有効な場合のみパーツを選択。無効ならnullを返す。
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
 * 共通ヘルパー: 条件に基づいて敵パーツを選択する
 * @param {World} world
 * @param {number[]} enemies - 敵エンティティIDの配列
 * @param {function} sortFn - パーツソート関数 (オプション)
 * @param {function} filterFn - パーツフィルタ関数 (オプション)
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
function selectPartByCondition(world, enemies, sortFn = null, filterFn = null) {
    const allParts = getAllEnemyParts(world, enemies);
    if (allParts.length === 0) return null;

    let filteredParts = allParts;
    if (filterFn) {
        filteredParts = allParts.filter(filterFn);
    }
    if (filteredParts.length === 0) return null;

    if (sortFn) {
        filteredParts.sort(sortFn);
    }

    const selectedPart = filteredParts[0];
    return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
}

/**
 * 指定されたエンティティから攻撃可能なパーツをランダムに1つ選択するヘルパー関数
 * @param {World} world
 * @param {number} entityId - ターゲットのエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null}
 */
function selectRandomPart(world, entityId) {
    if (!world || entityId === null || entityId === undefined) return null;
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;

    // 破壊されていない全てのパーツキーを取得する
    const hittablePartKeys = Object.keys(parts).filter(key => !parts[key].isBroken);

    if (hittablePartKeys.length > 0) {
        const partKey = hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)];
        return { targetId: entityId, targetPartKey: partKey };
    }
    return null; // 攻撃可能なパーツがない
}

/**
 * 指定された敵たちの、破壊されていない全パーツのリストを取得します
 * @param {World} world
 * @param {number[]} enemyIds
 * @returns {{entityId: number, partKey: string, part: object}[]}
 */
function getAllEnemyParts(world, enemyIds) {
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
