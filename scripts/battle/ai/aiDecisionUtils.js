/**
 * @file AI意思決定ユーティリティ
 * このファイルは、AIの思考ルーチンから共通して利用される、
 * ターゲット候補を決定し、最適な行動プランを選択するためのユーティリティ関数を提供します。
 */
import { Medal, PlayerInfo } from '../core/components/index.js';
import { getStrategiesFor } from './personalityRegistry.js';
import { targetingStrategies } from './targetingStrategies.js';
import { conditionEvaluators } from './conditionEvaluators.js';
import { partSelectionStrategies } from './partSelectionStrategies.js';

/**
 * AIの性格と思考ルーチンに基づいて最適なターゲット候補リストと使用された戦略を決定します。
 * @param {object} context - { world: World, entityId: number }
 * @returns {{candidates: Array<{ target: { targetId: number, targetPartKey: string }, weight: number }> | null, strategy: string | null}} 決定されたターゲット候補リストと戦略キー
 */
export function determineTargetCandidatesByPersonality({ world, entityId }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    if (!attackerMedal) return { candidates: null, strategy: null };

    const strategies = getStrategiesFor(attackerMedal.personality);
    const context = { world, attackerId: entityId };
    let finalCandidates = null;
    let successfulStrategy = null;

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
                successfulStrategy = routine.strategy;
                break; // 有効なターゲット候補が見つかったらループを抜ける
            }
        }
    }

    // --- Step 2: ルーチンでターゲット候補が決まらなかった場合のフォールバック ---
    if (!finalCandidates && strategies.fallbackTargeting) {
        const fallbackStrategyKey = strategies.fallbackTargeting;
        const fallbackStrategy = targetingStrategies[fallbackStrategyKey];
        if (fallbackStrategy) {
            finalCandidates = fallbackStrategy(context);
            if (finalCandidates && finalCandidates.length > 0) {
                successfulStrategy = fallbackStrategyKey;
            }
        } else {
            console.error(`AI ${entityId}: Fallback strategy key "${fallbackStrategyKey}" not found.`);
        }
    }

    return { candidates: finalCandidates, strategy: successfulStrategy };
}

/**
 * 与えられた行動プランのリストから、AIの性格に基づいて最適なプランを1つ選択します。
 * @param {object} context - { world: World, entityId: number, actionPlans: Array<object> }
 * @returns {object | null} 最適と判断された行動プラン
 */
export function selectBestActionPlan({ world, entityId, actionPlans }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    const strategies = getStrategiesFor(attackerMedal.personality);
    const attackerInfo = world.getComponent(entityId, PlayerInfo);
    let partStrategyKey;

    // 1. どのパーツ選択戦略を使うか決定する
    const preMovePlan = actionPlans.find(plan => plan.target !== null);

    if (preMovePlan) {
        // pre-moveプランがあれば、そのターゲット情報を基に戦略を決定
        const targetInfo = world.getComponent(preMovePlan.target.targetId, PlayerInfo);
        if (targetInfo && attackerInfo.teamId === targetInfo.teamId) {
            partStrategyKey = strategies.partStrategyMap.ally;
        } else {
            partStrategyKey = strategies.partStrategyMap.enemy;
        }
    } else {
        // pre-moveプランがない場合（全てpost-move）、アクションの性質から戦略を決定
        if (actionPlans.length > 0) {
            const representativePart = actionPlans[0].part;
            // targetScopeが'ALLY'で始まるかどうかで、味方対象か敵対象かを判断
            if (representativePart.targetScope?.startsWith('ALLY')) {
                partStrategyKey = strategies.partStrategyMap.ally;
            } else {
                // 敵対象、または自分自身を対象とするもの（SELF_GUARDなど）はenemy戦略を使用
                partStrategyKey = strategies.partStrategyMap.enemy;
            }
        }
    }

    if (!partStrategyKey) {
        console.warn(`AI ${entityId} (${attackerMedal.personality}): No part strategy found for the target type. Falling back.`);
        return actionPlans[Math.floor(Math.random() * actionPlans.length)];
    }

    // 2. パーツ選択戦略を実行して最適なパーツを決定する
    const partSelectionFunc = partSelectionStrategies[partStrategyKey];
    if (!partSelectionFunc) {
        console.error(`AI ${entityId}: Part strategy '${partStrategyKey}' not found. Falling back.`);
        return actionPlans[Math.floor(Math.random() * actionPlans.length)];
    }
    
    // パーツ選択戦略は `[partKey, part]` の形式の配列を期待するため、プランから変換する
    const availablePartsForStrategy = actionPlans.map(plan => [plan.partKey, plan.part]);
    const [bestPartKey] = partSelectionFunc({ world, entityId, availableParts: availablePartsForStrategy });

    // 3. 最適なパーツキーに対応する行動プランを返す
    return actionPlans.find(plan => plan.partKey === bestPartKey) || null;
}