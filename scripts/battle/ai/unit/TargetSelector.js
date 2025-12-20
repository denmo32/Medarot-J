/**
 * @file Unit AI: TargetSelector
 * @description メダルの性格（Unit AI）に基づいて、攻撃対象の候補をリストアップします。
 * 旧 aiDecisionUtils.js の一部 (determineTargetCandidatesByPersonality)
 */
import { Medal } from '../../../components/index.js';
import { getStrategiesFor } from './PersonalityRegistry.js';
import { targetingStrategies } from './strategies/index.js';
import { conditionEvaluators } from './Conditions.js';

/**
 * 性格に基づいてターゲット候補を決定する
 * @param {object} params
 * @param {World} params.world
 * @param {number} params.entityId
 * @returns {{ candidates: Array|null, strategy: string|null }}
 */
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