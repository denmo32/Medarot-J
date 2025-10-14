/**
 * @file ターゲット決定ユーティリティ (リファクタリング)
 * このファイルは、AIと思考ルーチン、そしてプレイヤーの入力補助から共通して利用される、
 * ターゲットを決定するためのユーティリティ関数を提供します。
 * 元々は `ai/` ディレクトリにありましたが、プレイヤーの補助機能にも使われるため汎用的な場所へ移動しました。
 */
import { PlayerInfo, GameState, Medal, Parts } from '../core/components.js';
import { PlayerStateType, EffectScope } from '../common/constants.js';
import { getValidEnemies, getValidAllies, isValidTarget } from '../utils/queryUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';
import { targetingStrategies } from '../ai/targetingStrategies.js';

/**
 * ★修正: ターゲット決定ロジックを大幅に単純化
 * この関数は、渡された「候補リスト」に対して、指定された「戦略」を実行することにのみ責任を持つ。
 * 候補リスト（敵か味方か）の作成責任は、呼び出し元（AiSystem, InputSystem）が担う。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {Function} strategy - 実行するターゲティング戦略関数
 * @param {number[]} candidates - ターゲット候補となるエンティティIDの配列
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId, strategy, candidates) {
    if (!strategy || !candidates || candidates.length === 0) {
        return null;
    }

    // 戦略の実行に必要なコンテキストを作成
    const strategyContext = {
        world,
        attackerId,
        candidates,
    };

    // 戦略を実行してターゲットを決定
    const target = strategy(strategyContext);

    // ターゲットが無効であればnullを返す
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        return null;
    }

    return target;
}


/**
 * @function determineRecommendedTarget
 * @description ★新規: プレイヤーの行動選択時に推奨ターゲットを提示するための共通関数。
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
    
    // パーツの対象範囲に応じてターゲット候補を決定
    const isAllyTargeting = part.targetScope?.startsWith('ALLY_');
    const candidates = isAllyTargeting
        ? getValidAllies(world, entityId, true)
        : getValidEnemies(world, entityId);

    // 1. 性格に定義された最初の思考ルーチンでターゲットを試行
    if (strategies.routines && strategies.routines.length > 0) {
        const primaryRoutine = strategies.routines[0];
        const primaryTargetingFunc = targetingStrategies[primaryRoutine.targetStrategy];
        if (primaryTargetingFunc) {
            target = determineTarget(world, entityId, primaryTargetingFunc, candidates);
        }
    }

    // 2. 最初のルーチンでターゲットが見つからない場合、フォールバック戦略を試行
    if (!target && strategies.fallbackTargeting) {
        // フォールバックは通常、敵を対象とするため、候補を敵に限定
        const fallbackCandidates = getValidEnemies(world, entityId);
        target = determineTarget(world, entityId, strategies.fallbackTargeting, fallbackCandidates);
    }

    return target;
}