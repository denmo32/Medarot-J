// scripts/ai/targetingUtils.js

import { PlayerInfo, GameState, Medal } from '../core/components.js';
import { PlayerStateType } from '../common/constants.js';
import { targetingStrategies, isValidTarget } from './targetingStrategies.js';

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

    // 性格に対応する戦略関数を取得。各戦略は自己完結しているため、この関数は単なる呼び出し窓口になります。
    const strategy = targetingStrategies[attackerMedal.personality] || targetingStrategies.RANDOM;
    let target = strategy(world, attackerId, enemies);

    // 戦略が見つけられなかった場合のフォールバック処理を簡素化。
    // 各戦略関数は、ターゲットが見つからない場合に、内部でRANDOM戦略を呼び出すかnullを返す責務を負います。
    // ここでは、最終的にターゲットが見つからなかった場合のみ、安全策としてRANDOM戦略を呼び出します。
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        // ターゲットが見つからない、または無効な場合は、デフォルトのRANDOM戦略で再決定する
        target = targetingStrategies.RANDOM(world, attackerId, enemies);
    }

    return target;
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
