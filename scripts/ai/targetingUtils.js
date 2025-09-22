/**
 * @file ターゲット決定ユーティリティ
 * 攻撃者のメダルの性格に基づき、ターゲットを決定するためのユーティリティ関数を提供します。
 */
import { PlayerInfo, GameState, Medal } from '../core/components.js';
import { PlayerStateType } from '../common/constants.js';
import { targetingStrategies } from './targetingStrategies.js';
import { getValidEnemies, isValidTarget } from '../utils/battleUtils.js';

/**
 * 攻撃者のメダルの性格に基づき、ターゲット（敵エンティティとパーツ）を決定します。
 * 
 * ★修正: ターゲット決定のフォールバック処理を追加
 * 性格に基づいた戦略（例: COUNTER）がターゲットを見つけられない、またはターゲットが無効（破壊済みなど）であった場合に、
 * 安全策として基本的な「RANDOM」戦略で再試行するロジックを追加しました。
 * これにより、いかなる状況でも有効なターゲットを決定しようと試み、行動が不発に終わることを防ぎます。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId) {
    const attackerMedal = world.getComponent(attackerId, Medal);
    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;
    
    // ★改善: 各戦略関数に渡す引数を単一のコンテキストオブジェクトに集約。
    // これにより、将来的に戦略が必要とする情報が増えても、関数のシグネチャを変更する必要がなくなり、柔軟性が向上します。
    const strategyContext = {
        world,
        attackerId,
        enemies,
    };

    // 手順1: 本来の性格に基づいた戦略でターゲット候補を決定します。
    const primaryStrategy = targetingStrategies[attackerMedal.personality] || targetingStrategies.RANDOM;
    let target = primaryStrategy(strategyContext);
    
    // 手順2: ターゲット候補が「存在しない」または「無効（破壊済みなど）」であるか検証します。
    // isValidTargetは、ターゲットエンティティの生存と、指定されたパーツが破壊されていないかを確認するヘルパー関数です。
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        // 手順3: 検証に失敗した場合、フォールバックとしてRANDOM戦略を実行し、ターゲットを再決定します。
        target = targetingStrategies.RANDOM(strategyContext);
    }
    
    return target;
}