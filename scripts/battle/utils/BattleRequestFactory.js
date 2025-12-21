/**
 * @file BattleRequestFactory.js
 * @description アクションリクエスト生成ヘルパー。
 * importパス修正: PartsはCommon
 */
import { Parts as CommonParts } from '../../components/index.js'; // Common, via index
import { TargetTiming } from '../common/constants.js';
import { ActionState, ActionRequeueState } from '../components/States.js';
import { BattleQueries } from '../queries/BattleQueries.js';

export const BattleRequestFactory = {
    /**
     * アクションリクエストを作成し、Worldに追加する
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} partKey 
     * @param {object} target 
     */
    createActionRequest(world, entityId, partKey, target = null) {
        const parts = world.getComponent(entityId, CommonParts);

        if (!parts || !partKey) {
            this._requeue(world, entityId);
            return;
        }

        const partId = parts[partKey];
        const selectedPart = BattleQueries.getPartData(world, partId);

        if (!selectedPart || selectedPart.isBroken) {
            console.warn(`BattleRequestFactory: Invalid or broken part selected for entity ${entityId}. Re-queueing.`);
            this._requeue(world, entityId);
            return;
        }

        // ターゲット検証 (PRE_MOVE)
        if (selectedPart.targetTiming === TargetTiming.PRE_MOVE && 
            selectedPart.targetScope?.endsWith('_SINGLE') && 
            !BattleQueries.isValidTarget(world, target?.targetId, target?.targetPartKey)) {
            
            console.error(`BattleRequestFactory: A valid target was expected but not found. Action may fail.`, {entityId, partKey, target});
        }

        // ActionState コンポーネントを持つエンティティを作成
        const stateEntity = world.createEntity();
        const actionState = new ActionState();
        actionState.state = 'selected';
        actionState.entityId = entityId;
        actionState.partKey = partKey;
        actionState.targetId = target ? target.targetId : null;
        actionState.targetPartKey = target ? target.targetPartKey : null;
        
        world.addComponent(stateEntity, actionState);
    },

    _requeue(world, entityId) {
        const stateEntity = world.createEntity();
        const actionRequeueState = new ActionRequeueState();
        actionRequeueState.isActive = true;
        actionRequeueState.entityId = entityId;
        world.addComponent(stateEntity, actionRequeueState);
    }
};