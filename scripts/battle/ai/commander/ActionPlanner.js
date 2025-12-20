/**
 * @file Commander AI: ActionPlanner
 * @description 提示されたターゲット候補と手持ちのパーツから、最適なアクションプラン（どのパーツを使うか）を決定します。
 * 旧 aiDecisionUtils.js の一部 (selectBestActionPlan)
 */
import { Medal, PlayerInfo } from '../../../components/index.js';
import { getStrategiesFor } from '../unit/PersonalityRegistry.js';
import { partSelectionStrategies } from './PartStrategies.js';

/**
 * アクションプランの中から最適なものを選択する
 * @param {object} params
 * @param {World} params.world
 * @param {number} params.entityId
 * @param {Array} params.actionPlans - 実行可能なアクションのリスト
 */
export function selectBestActionPlan({ world, entityId, actionPlans }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    // 性格に基づいたパーツ選択戦略マップを取得
    const strategies = getStrategiesFor(attackerMedal.personality);
    
    // 味方を狙う行動か敵を狙う行動かで戦略キーを決定
    const partStrategyKey = determinePartStrategyKey(world, entityId, actionPlans, strategies);

    if (!partStrategyKey) {
        console.warn(`AI ${entityId} (${attackerMedal.personality}): No part strategy found. Falling back to random.`);
        return getRandomPlan(actionPlans);
    }

    const partSelectionFunc = partSelectionStrategies[partStrategyKey];
    if (!partSelectionFunc) {
        console.error(`AI ${entityId}: Part strategy '${partStrategyKey}' not found. Falling back to random.`);
        return getRandomPlan(actionPlans);
    }
    
    // 戦略関数に渡すためにフォーマット変換 [partKey, partData]
    const availablePartsForStrategy = actionPlans.map(plan => [plan.partKey, plan.part]);
    
    // 戦略を実行してベストなパーツキーを取得
    const [bestPartKey] = partSelectionFunc({ world, entityId, availableParts: availablePartsForStrategy });

    return actionPlans.find(plan => plan.partKey === bestPartKey) || null;
}

function determinePartStrategyKey(world, attackerId, actionPlans, strategies) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    
    // ターゲットが既に決まっている場合（Pre-Moveなど）、そのターゲットが味方か敵かで判断
    const preMovePlan = actionPlans.find(plan => plan.target !== null);
    if (preMovePlan) {
        const targetInfo = world.getComponent(preMovePlan.target.targetId, PlayerInfo);
        return (targetInfo && attackerInfo.teamId === targetInfo.teamId)
            ? strategies.partStrategyMap.ally
            : strategies.partStrategyMap.enemy;
    } 
    
    // ターゲット未定の場合、パーツの性質（回復など）から推測
    if (actionPlans.length > 0) {
        const representativePart = actionPlans[0].part;
        if (representativePart.targetScope?.startsWith('ALLY')) {
            return strategies.partStrategyMap.ally;
        }
        return strategies.partStrategyMap.enemy;
    }

    return null;
}

function getRandomPlan(plans) {
    return plans.length > 0 ? plans[Math.floor(Math.random() * plans.length)] : null;
}