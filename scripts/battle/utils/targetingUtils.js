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
import { conditionEvaluators } from '../ai/conditionEvaluators.js';

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
 * AIとプレイヤー補助のターゲット決定ロジックを統合した新しい共通関数。
 * @param {object} context - { world: World, entityId: number }
 * @returns {{target: {targetId: number, targetPartKey: string} | null, strategyKey: string | null}} 決定されたターゲット情報と使用された戦略キー
 */
export function determineTargetByPersonality({ world, entityId }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    if (!attackerMedal) return { target: null, strategyKey: null };

    const strategies = getStrategiesFor(attackerMedal.personality);
    const context = { world, entityId };
    let finalTarget = null;
    let usedStrategyKey = null;

    // --- Step 1: 思考ルーチンに定義されたターゲット戦略を順番に試行 ---
    if (strategies.routines && strategies.routines.length > 0) {
        for (const routine of strategies.routines) {
            // ルーチンに実行条件(condition)が定義されていれば評価する
            if (routine.condition) {
                const evaluator = conditionEvaluators[routine.condition.type];
                if (evaluator) {
                    if (!evaluator({ ...context, params: routine.condition.params })) {
                        continue; // 条件を満たさなければこのルーチンはスキップ
                    }
                } else {
                    console.warn(`determineTargetByPersonality: Unknown condition type '${routine.condition.type}' for ${attackerMedal.personality}.`);
                    continue;
                }
            }
            
            const targetSelectionFunc = targetingStrategies[routine.targetStrategy];
            if (!targetSelectionFunc) {
                console.warn(`determineTargetByPersonality: Unknown targetStrategy '${routine.targetStrategy}' in routines for ${attackerMedal.personality}.`);
                continue;
            }
            
            const target = determineTarget(world, entityId, targetSelectionFunc, routine.targetStrategy);

            if (target) {
                finalTarget = target;
                usedStrategyKey = routine.targetStrategy;
                break; // 有効なターゲットが見つかったらループを抜ける
            }
        }
    }

    // --- Step 2: ルーチンでターゲットが決まらなかった場合の最終フォールバック ---
    if (!finalTarget && strategies.fallbackTargeting) {
        const fallbackKey = Object.keys(targetingStrategies).find(key => targetingStrategies[key] === strategies.fallbackTargeting);
        finalTarget = determineTarget(world, entityId, strategies.fallbackTargeting, fallbackKey);
        usedStrategyKey = fallbackKey;
    }

    return { target: finalTarget, strategyKey: usedStrategyKey };
}


/**
 * @function determineRecommendedTarget
 * @description プレイヤーの行動選択時に推奨ターゲットを提示するための共通関数。
 * 内部ロジックを新しい共通関数`determineTargetByPersonality`に置き換えます。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {object} part - 選択が検討されているパーツオブジェクト (現在は未使用ですが、将来的な拡張のため残置)
 * @returns {{targetId: number, targetPartKey: string} | null} 推奨ターゲット情報、またはnull
 */
export function determineRecommendedTarget(world, entityId, part) {
    // ターゲット決定ロジックを共通関数に委譲し、ターゲット情報のみを返す
    const { target } = determineTargetByPersonality({ world, entityId });
    return target;
}