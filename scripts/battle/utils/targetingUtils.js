/**
 * @file ターゲット決定ユーティリティ
 * このファイルは、AIと思考ルーチン、そしてプレイヤーの入力補助から共通して利用される、
 * ターゲットを決定するためのユーティリティ関数を提供します。
 * 元々は `ai/` ディレクトリにありましたが、プレイヤーの補助機能にも使われるため汎用的な場所へ移動しました。
 */
import { PlayerInfo, GameState, Medal, Parts } from '../core/components/index.js';
import { PlayerStateType, EffectScope } from '../common/constants.js';
import { getValidEnemies, getValidAllies, isValidTarget, getCandidatesByScope } from '../utils/queryUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';
import { targetingStrategies } from '../ai/targetingStrategies.js';
import { GameEvents } from '../common/events.js';
import { CONFIG } from '../common/config.js';

/**
 * この関数は、指定された「戦略」を実行することにのみ責任を持つ。
 * ターゲット候補リストの作成は各戦略関数自身が担当します。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {Function} strategy - 実行するターゲティング戦略関数
 * @param {string} strategyKey - 実行した戦略のキー (イベント発行用)
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId, strategy, strategyKey) {
    if (!strategy) {
        return null;
    }

    // 戦略の実行に必要なコンテキストを作成
    const strategyContext = {
        world,
        attackerId,
    };

    // 戦略を実行してターゲットを決定
    const target = strategy(strategyContext);

    // ターゲットが無効であればnullを返す
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        return null;
    }

    // 戦略が成功した場合、イベントを発行する
    if (strategyKey) {
        world.emit(GameEvents.STRATEGY_EXECUTED, {
            strategy: strategyKey,
            attackerId: attackerId,
            target: target
        });
    }

    return target;
}


/**
 * @function determineRecommendedTarget
 * @description プレイヤーの行動選択時に推奨ターゲットを提示するための共通関数。
 * エンティティの性格に基づき、最も優先度の高い思考ルーチンを実行してターゲットを決定します。
 * AIの思考ロジックの一部をプレイヤー補助のために再利用します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {object} part - 選択が検討されているパーツオブジェクト
 * @returns {{targetId: number, targetPartKey: string} | null} 推奨ターゲット情報、またはnull
 */
export function determineRecommendedTarget(world, entityId, part) {
    const attackerMedal = world.getComponent(entityId, Medal);
    if (!attackerMedal) return null;

    const strategies = getStrategiesFor(attackerMedal.personality);
    let target = null;
    
    // 候補リストの作成は各戦略に委譲するため、ここでは不要。

    // 1. 性格に定義された最初の思考ルーチンでターゲットを試行
    if (strategies.routines && strategies.routines.length > 0) {
        const primaryRoutine = strategies.routines[0];
        const primaryTargetingFunc = targetingStrategies[primaryRoutine.targetStrategy];
        if (primaryTargetingFunc) {
            // 候補リストを渡さずに呼び出し
            target = determineTarget(world, entityId, primaryTargetingFunc, primaryRoutine.targetStrategy);
        }
    }

    // 2. 最初のルーチンでターゲットが見つからない場合、フォールバック戦略を試行
    if (!target && strategies.fallbackTargeting) {
        const fallbackKey = Object.keys(targetingStrategies).find(key => targetingStrategies[key] === strategies.fallbackTargeting);
        // 候補リストを渡さずに呼び出し
        target = determineTarget(world, entityId, strategies.fallbackTargeting, fallbackKey);
    }

    return target;
}