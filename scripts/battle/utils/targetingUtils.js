/**
 * @file ターゲット決定および行動計画ユーティリティ
 * このファイルは、AIやプレイヤーの入力補助から共通して利用される、
 * 「行動プラン」を生成するための関数を提供します。
 */
import { getAttackableParts } from './queryUtils.js';
import { selectItemByProbability } from '../../../engine/utils/MathUtils.js';
import { TargetTiming } from '../common/constants.js';

/**
 * 重み付けされたターゲット候補リストと使用可能パーツから、パーツごとの行動プランリストを生成します。
 * 各パーツは、候補リストから確率的にターゲットを一つ選択します。
 * targetTimingが'post-move'のパーツについては、ターゲットをnullに設定します。
 * @param {object} context - { world: World, entityId: number, targetCandidates: Array }
 * @returns {Array<{ partKey: string, part: object, target: { targetId: number, targetPartKey: string } | null }>} 行動プランのリスト
 */
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

        // targetTimingが pre-move の場合のみ、事前にターゲットを決定する
        if (part.targetTiming === TargetTiming.PRE_MOVE) {
            const selectedCandidate = selectItemByProbability(targetCandidates);
            if (selectedCandidate) {
                selectedTarget = selectedCandidate.target;
            }
        }
        // post-move の場合は selectedTarget は null のまま

        actionPlans.push({
            partKey,
            part,
            target: selectedTarget,
        });
    }
    return actionPlans;
}