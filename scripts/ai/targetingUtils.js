/**
 * @file ターゲット決定ユーティリティ
 * 攻撃者のメダルの性格に基づき、ターゲットを決定するためのユーティリティ関数を提供します。
 */
import { PlayerInfo, GameState, Medal } from '../core/components.js';
import { PlayerStateType } from '../common/constants.js';
import { targetingStrategies } from './targetingStrategies.js';
// ★変更: isValidTargetのインポートを削除（現在は戦略内で処理されるため不要）
import { getValidEnemies } from '../utils/battleUtils.js';

/**
 * 攻撃者のメダルの性格に基づき、ターゲット（敵エンティティとパーツ）を決定します。
 * 
 * なぜこの簡素化が必要か？
 * 以前は、各戦略関数内でターゲットの有効性チェックを行い、無効な場合はフォールバック処理を実施していました。
 * しかし、この処理はdetermineTarget関数で一元管理すべきではありません。
 * 
 * 現在の設計では、各戦略関数が自身の責務としてターゲットの有効性チェックとフォールバック処理を担当します。
 * これにより、determineTarget関数は単に戦略関数を呼び出すだけのシンプルなファサードとなり、
 * コードの責務が明確になり、冗長なチェックが排除されました。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId) {
    const attackerMedal = world.getComponent(attackerId, Medal);
    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;
    
    // 性格に対応する戦略関数を取得。各戦略は自身の責任でターゲットの有効性を確認し、
    // 必要に応じてフォールバック処理を実施します。この関数は単に戦略関数を呼び出すだけです。
    const strategy = targetingStrategies[attackerMedal.personality] || targetingStrategies.RANDOM;
    return strategy(world, attackerId, enemies);
}