/**
 * @file ターゲット決定および行動計画ユーティリティ
 */
import { getAttackableParts } from './queryUtils.js';
import { selectItemByProbability } from '../../../engine/utils/MathUtils.js';
import { TargetTiming } from '../common/constants.js';

export function determineActionPlans({ world, entityId, targetCandidates }) {
    if (!targetCandidates || targetCandidates.length === 0) {
        return [];
    }
    
    const availableParts = getAttackableParts(world, entityId);
    if (availableParts.length === 0) {
        return [];
    }

    const actionPlans = [];
    for (const [partKey, part] of availableParts) {
        let selectedTarget = null;

        if (part.targetTiming === TargetTiming.PRE_MOVE) {
            const selectedCandidate = selectItemByProbability(targetCandidates);
            if (selectedCandidate) {
                selectedTarget = selectedCandidate.target;
            }
        }

        actionPlans.push({
            partKey,
            part,
            target: selectedTarget,
        });
    }
    return actionPlans;
}