/**
 * @file AI意思決定ユーティリティ
 * このファイルは、AIの思考ルーチンから共通して利用される、
 * ターゲット候補を決定するためのユーティリティ関数を提供します。
 */
import { Medal } from '../core/components/index.js';
import { getStrategiesFor } from './personalityRegistry.js';
import { targetingStrategies } from './targetingStrategies.js';
import { conditionEvaluators } from './conditionEvaluators.js';

/**
 * AIの性格と思考ルーチンに基づいて最適なターゲット候補リストを決定します。
 * @param {object} context - { world: World, entityId: number }
 * @returns {Array<{ target: { targetId: number, targetPartKey: string }, weight: number }> | null} 決定されたターゲット候補リスト
 */
export function determineTargetCandidatesByPersonality({ world, entityId }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    if (!attackerMedal) return null;

    const strategies = getStrategiesFor(attackerMedal.personality);
    const context = { world, attackerId: entityId };
    let finalCandidates = null;

    // --- Step 1: 思考ルーチンに定義されたターゲット戦略を順番に試行 ---
    if (strategies.targetRoutines && strategies.targetRoutines.length > 0) {
        for (const routine of strategies.targetRoutines) {
            // ルーチンに実行条件(condition)が定義されていれば評価する
            if (routine.condition) {
                const evaluator = conditionEvaluators[routine.condition.type];
                if (evaluator) {
                    if (!evaluator({ ...context, params: routine.condition.params })) {
                        continue; // 条件を満たさなければこのルーチンはスキップ
                    }
                } else {
                    console.warn(`determineTargetCandidatesByPersonality: Unknown condition type '${routine.condition.type}' for ${attackerMedal.personality}.`);
                    continue;
                }
            }
            
            const targetSelectionFunc = targetingStrategies[routine.strategy];
            if (!targetSelectionFunc) {
                console.warn(`determineTargetCandidatesByPersonality: Unknown targetStrategy '${routine.strategy}' in routines for ${attackerMedal.personality}.`);
                continue;
            }
            
            const candidates = targetSelectionFunc(context);

            if (candidates && candidates.length > 0) {
                finalCandidates = candidates;
                break; // 有効なターゲット候補が見つかったらループを抜ける
            }
        }
    }

    // --- Step 2: ルーチンでターゲット候補が決まらなかった場合のフォールバック ---
    if (!finalCandidates && strategies.fallbackTargeting) {
        const fallbackStrategy = targetingStrategies[strategies.fallbackTargeting];
        if (fallbackStrategy) {
            finalCandidates = fallbackStrategy(context);
        } else {
            console.error(`AI ${entityId}: Fallback strategy key "${strategies.fallbackTargeting}" not found.`);
        }
    }

    return finalCandidates;
}