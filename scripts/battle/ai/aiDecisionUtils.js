/**
 * @file AI意思決定ユーティリティ
 * このファイルは、AIの思考ルーチンから共通して利用される、
 * ターゲットを決定するためのユーティリティ関数を提供します。
 * 元々は汎用的な `targetingUtils.js` にありましたが、AIの内部仕様に強く依存するため、
 * AIモジュール内に移動しました。
 */
import { Medal } from '../core/components/index.js';
import { getStrategiesFor } from './personalityRegistry.js';
import { targetingStrategies } from './targetingStrategies.js';
import { GameEvents } from '../common/events.js';
import { conditionEvaluators } from './conditionEvaluators.js';
import { isValidTarget } from '../utils/queryUtils.js';
import { determineTarget } from '../utils/targetingUtils.js';


/**
 * AIの性格と思考ルーチンに基づいて最適なターゲットを決定します。
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

    // --- Step 2: ルーチンでターゲットが決まらなかった場合のフォールバック ---
    if (!finalTarget && strategies.fallbackTargeting) {
        // ★修正: fallbackTargetingは関数参照ではなくキー文字列であるため、キーから関数を解決します。
        const fallbackStrategy = targetingStrategies[strategies.fallbackTargeting];
        if (fallbackStrategy) {
            finalTarget = determineTarget(world, entityId, fallbackStrategy, strategies.fallbackTargeting);
            usedStrategyKey = strategies.fallbackTargeting;
        } else {
            console.error(`AI ${entityId}: Fallback strategy key "${strategies.fallbackTargeting}" not found.`);
        }
    }

    return { target: finalTarget, strategyKey: usedStrategyKey };
}


/**
 * @function determineRecommendedTarget
 * @description プレイヤーの行動選択時に、狙っているターゲットを表示するための共通関数。
 * 内部ロジックを`determineTargetByPersonality`に委譲します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {object} part - 選択が検討されているパーツオブジェクト (現在は未使用ですが、将来的な拡張のため残置)
 * @returns {{targetId: number, targetPartKey: string} | null} 予定ターゲット情報、またはnull
 */
export function determineRecommendedTarget(world, entityId, part) {
    // ターゲット決定ロジックを共通関数に委譲し、ターゲット情報のみを返す
    const { target } = determineTargetByPersonality({ world, entityId });
    return target;
}