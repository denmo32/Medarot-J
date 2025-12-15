/**
 * @file ActionService.js
 * @description アクションの妥当性を検証し、リクエストコンポーネントを生成する静的サービス。
 * Worldへのコンポーネント追加のみを行い、副作用を持たない設計。
 */
import { Parts as CommonParts } from '../../components/index.js';
import { TargetingService } from './TargetingService.js';
import { TargetTiming } from '../common/constants.js';
import { ActionSelectedRequest, ActionRequeueRequest } from '../components/Requests.js';

export class ActionService {
    /**
     * アクションリクエストを作成し、Worldに追加する
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} partKey 
     * @param {object} target 
     */
    static createActionRequest(world, entityId, partKey, target = null) {
        const parts = world.getComponent(entityId, CommonParts);

        if (!parts || !partKey || !parts[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionService: Invalid or broken part selected for entity ${entityId}. Re-queueing.`);
            const reqEntity = world.createEntity();
            world.addComponent(reqEntity, new ActionRequeueRequest(entityId));
            return;
        }

        const selectedPart = parts[partKey];

        // ターゲット検証 (PRE_MOVE)
        if (selectedPart.targetTiming === TargetTiming.PRE_MOVE && 
            selectedPart.targetScope?.endsWith('_SINGLE') && 
            !TargetingService.isValidTarget(world, target?.targetId, target?.targetPartKey)) {
            
            console.error(`ActionService: A valid target was expected but not found. Action may fail.`, {entityId, partKey, target});
            // 続行させてSystem側でキャンセル判定させるフローとする
        }

        // ActionSelectedRequest コンポーネントを持つエンティティを作成
        // これは次のフレームで ActionSelectionSystem によって処理される
        const reqEntity = world.createEntity();
        world.addComponent(reqEntity, new ActionSelectedRequest(
            entityId,
            partKey,
            target ? target.targetId : null,
            target ? target.targetPartKey : null
        ));
    }
}