/**
 * @file ターゲット決定ユーティリティ
 * 攻撃者のメダルの性格に基づき、ターゲットを決定するためのユーティリティ関数を提供します。
 */
import { PlayerInfo, GameState, Medal } from '../core/components.js';
import { PlayerStateType } from '../common/constants.js';
import { getValidEnemies, isValidTarget } from '../utils/queryUtils.js';
import { getStrategiesFor } from './personalityRegistry.js';

/**
 * 攻撃者のメダルの性格に基づき、ターゲット（敵エンティティとパーツ）を決定します。
 * 
 * ★修正: ターゲット決定ロジックを`personalityRegistry`に依存するように変更
 * 性格に基づいた戦略がターゲットを見つけられない、またはターゲットが無効であった場合に、
 * レジストリに定義されたフォールバック戦略（多くは'RANDOM'）で再試行するロジックに更新しました。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId) {
    const attackerMedal = world.getComponent(attackerId, Medal);
    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;
    
    const strategyContext = {
        world,
        attackerId,
        enemies,
    };

    // レジストリから性格に合った戦略セットを取得
    const strategies = getStrategiesFor(attackerMedal.personality);

    // 手順1: 本来の性格に基づいた戦略でターゲット候補を決定します。
    let target = strategies.primaryTargeting(strategyContext);
    
    // 手順2: ターゲット候補が「存在しない」または「無効（破壊済みなど）」であるか検証します。
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        // 手順3: 検証に失敗した場合、フォールバック戦略を実行し、ターゲットを再決定します。
        target = strategies.fallbackTargeting(strategyContext);
    }
    
    return target;
}