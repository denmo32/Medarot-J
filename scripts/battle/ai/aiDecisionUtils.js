/**
 * @file AI意思決定ユーティリティ
 */
import { Medal, PlayerInfo } from '../components/index.js';
import { getStrategiesFor } from './personalityRegistry.js';
import { targetingStrategies } from './targetingStrategies.js';
import { conditionEvaluators } from './conditionEvaluators.js';
import { partSelectionStrategies } from './partSelectionStrategies.js';

export function determineTargetCandidatesByPersonality({ world, entityId }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    if (!attackerMedal) return { candidates: null, strategy: null };

    const strategies = getStrategiesFor(attackerMedal.personality);
    const context = { world, attackerId: entityId };

    const routineResult = tryExecuteRoutines(strategies.targetRoutines, context, attackerMedal.personality);
    if (routineResult) {
        return routineResult;
    }

    return executeFallbackStrategy(strategies.fallbackTargeting, context, entityId);
}

function tryExecuteRoutines(routines, context, personalityName) {
    if (!routines || routines.length === 0) return null;

    for (const routine of routines) {
        if (routine.condition) {
            const evaluator = conditionEvaluators[routine.condition.type];
            if (!evaluator) {
                console.warn(`AI Decision: Unknown condition type '${routine.condition.type}' for ${personalityName}.`);
                continue;
            }
            if (!evaluator({ ...context, params: routine.condition.params })) {
                continue;
            }
        }
        
        const targetSelectionFunc = targetingStrategies[routine.strategy];
        if (!targetSelectionFunc) {
            console.warn(`AI Decision: Unknown targetStrategy '${routine.strategy}' in routines for ${personalityName}.`);
            continue;
        }
        
        const candidates = targetSelectionFunc(context);

        if (candidates && candidates.length > 0) {
            return { candidates, strategy: routine.strategy };
        }
    }
    
    return null;
}

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

export function selectBestActionPlan({ world, entityId, actionPlans }) {
    const attackerMedal = world.getComponent(entityId, Medal);
    const strategies = getStrategiesFor(attackerMedal.personality);
    
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
    
    const availablePartsForStrategy = actionPlans.map(plan => [plan.partKey, plan.part]);
    const [bestPartKey] = partSelectionFunc({ world, entityId, availableParts: availablePartsForStrategy });

    return actionPlans.find(plan => plan.partKey === bestPartKey) || null;
}

function determinePartStrategyKey(world, attackerId, actionPlans, strategies) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    
    const preMovePlan = actionPlans.find(plan => plan.target !== null);
    if (preMovePlan) {
        const targetInfo = world.getComponent(preMovePlan.target.targetId, PlayerInfo);
        return (targetInfo && attackerInfo.teamId === targetInfo.teamId)
            ? strategies.partStrategyMap.ally
            : strategies.partStrategyMap.enemy;
    } 
    
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