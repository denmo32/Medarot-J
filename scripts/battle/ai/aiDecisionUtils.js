/**
 * @file AI意思決定ユーティリティ
 * このファイルは、AIの思考ルーチンから共通して利用される、
 * ターゲット候補を決定し、最適な行動プランを選択するためのユーティリティ関数を提供します。
 */
import { Medal, PlayerInfo } from '../../../components/common/index.js';
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

    // 1. 思考ルーチンに定義されたターゲット戦略を順番に試行
    const routineResult = tryExecuteRoutines(strategies.targetRoutines, context, attackerMedal.personality);
    if (routineResult) {
        return routineResult;
    }

    // 2. ルーチンでターゲット候補が決まらなかった場合のフォールバック
    return executeFallbackStrategy(strategies.fallbackTargeting, context, entityId);
}

/**
 * 定義された思考ルーチンを順番に評価・実行します。
 * @param {Array} routines - 思考ルーチンのリスト
 * @param {object} context - 実行コンテキスト
 * @param {string} personalityName - デバッグ用の性格名
 * @returns {{candidates: Array, strategy: string} | null} 成功した場合は結果オブジェクト、失敗した場合はnull
 */
function tryExecuteRoutines(routines, context, personalityName) {
    if (!routines || routines.length === 0) return null;

    for (const routine of routines) {
        // 実行条件(condition)の評価
        if (routine.condition) {
            const evaluator = conditionEvaluators[routine.condition.type];
            if (!evaluator) {
                console.warn(`AI Decision: Unknown condition type '${routine.condition.type}' for ${personalityName}.`);
                continue;
            }
            // 条件を満たさなければスキップ
            if (!evaluator({ ...context, params: routine.condition.params })) {
                continue;
            }
        }
        
        // 戦略関数の取得と実行
        const targetSelectionFunc = targetingStrategies[routine.strategy];
        if (!targetSelectionFunc) {
            console.warn(`AI Decision: Unknown targetStrategy '${routine.strategy}' in routines for ${personalityName}.`);
            continue;
        }
        
        const candidates = targetSelectionFunc(context);

        // 有効な候補が見つかれば結果を返す
        if (candidates && candidates.length > 0) {
            return { candidates, strategy: routine.strategy };
        }
    }
    
    return null;
}

/**
 * フォールバック戦略を実行します。
 * @param {string} strategyKey - 戦略キー
 * @param {object} context - 実行コンテキスト
 * @param {number} entityId - デバッグ用のエンティティID
 * @returns {{candidates: Array, strategy: string} | {candidates: null, strategy: null}}
 */
function executeFallbackStrategy(strategyKey, context, entityId) {
    if (!strategyKey) return { candidates: null, strategy: null };

    const fallbackStrategy = targetingStrategies[strategyKey];
    if (fallbackStrategy) {
        const candidates = fallbackStrategy(context);
        if (candidates && candidates.length > 0) {
            return { candidates, strategy: strategyKey };
        }
    } else {
        console.error(`AI ${entityId}: Fallback strategy key "${strategyKey}" not found.`);
    }

    return { candidates: null, strategy: null };
}

/**
 * 与えられた行動プランのリストから、AIの性格に基づいて最適なプランを1つ選択します。
 * @param {object} context - { world: World, entityId: number, actionPlans: Array<object> }
 * @returns {object | null} 最適と判断された行動プラン
 */
export function selectBestActionPlan({ world, entityId, actionPlans }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    const strategies = getStrategiesFor(attackerMedal.personality);
    
    // 1. ターゲットの種類（敵/味方）に基づいて使用する戦略キーを決定
    const partStrategyKey = determinePartStrategyKey(world, entityId, actionPlans, strategies);

    if (!partStrategyKey) {
        console.warn(`AI ${entityId} (${attackerMedal.personality}): No part strategy found. Falling back to random.`);
        return getRandomPlan(actionPlans);
    }

    // 2. パーツ選択戦略を実行
    const partSelectionFunc = partSelectionStrategies[partStrategyKey];
    if (!partSelectionFunc) {
        console.error(`AI ${entityId}: Part strategy '${partStrategyKey}' not found. Falling back to random.`);
        return getRandomPlan(actionPlans);
    }
    
    // パーツ選択戦略は `[partKey, part]` の形式の配列を期待するため変換
    const availablePartsForStrategy = actionPlans.map(plan => [plan.partKey, plan.part]);
    const [bestPartKey] = partSelectionFunc({ world, entityId, availableParts: availablePartsForStrategy });

    // 3. 最適なパーツキーに対応する行動プランを返す
    return actionPlans.find(plan => plan.partKey === bestPartKey) || null;
}

/**
 * アクションプランの内容から、敵用・味方用どちらのパーツ選択戦略を使うかを決定します。
 */
function determinePartStrategyKey(world, attackerId, actionPlans, strategies) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    
    // pre-moveプラン（ターゲットが決まっているもの）がある場合
    const preMovePlan = actionPlans.find(plan => plan.target !== null);
    if (preMovePlan) {
        const targetInfo = world.getComponent(preMovePlan.target.targetId, PlayerInfo);
        // 同じチームなら味方用、そうでなければ敵用
        return (targetInfo && attackerInfo.teamId === targetInfo.teamId)
            ? strategies.partStrategyMap.ally
            : strategies.partStrategyMap.enemy;
    } 
    
    // post-moveプランのみの場合（ターゲット未定）、アクションのスコープ定義から判断
    if (actionPlans.length > 0) {
        const representativePart = actionPlans[0].part;
        if (representativePart.targetScope?.startsWith('ALLY')) {
            return strategies.partStrategyMap.ally;
        }
        // 敵対象、または自分自身を対象とするものはenemy戦略（攻撃的な選択基準）を使用
        return strategies.partStrategyMap.enemy;
    }

    return null;
}

function getRandomPlan(plans) {
    return plans.length > 0 ? plans[Math.floor(Math.random() * plans.length)] : null;
}
