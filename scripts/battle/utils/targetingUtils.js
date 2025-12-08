/**
 * @file ターゲット決定および行動計画ユーティリティ
 */
import { QueryService } from '../services/QueryService.js';
import { selectItemByProbability } from '../../../engine/utils/MathUtils.js';
// scripts/battle/utils/ -> ../../common/constants.js
import { TargetTiming as CommonTargetTiming } from '../../common/constants.js';

export function determineActionPlans({ world, entityId, targetCandidates }) {
    if (!targetCandidates || targetCandidates.length === 0) {
        return [];
    }
    
    const availableParts = QueryService.getAttackableParts(world, entityId);
    if (availableParts.length === 0) {
        return [];
    }

    const actionPlans = [];
    for (const [partKey, part] of availableParts) {
        let selectedTarget = null;

        if (part.targetTiming === CommonTargetTiming.PRE_MOVE) {
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