/**
 * @file ValidationLogic.js
 * @description アクションのキャンセル判定などの妥当性検証ロジック。
 * importパス修正
 */
import { Action } from '../components/index.js'; // Battle components
import { Parts, PlayerInfo } from '../../components/index.js'; // Common components
import { ActionCancelReason } from '../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { MessageFormatter } from '../utils/MessageFormatter.js';
import { BattleQueries } from '../queries/BattleQueries.js';

const cancelReasonToMessageKey = {
    [ActionCancelReason.PART_BROKEN]: MessageKey.CANCEL_PART_BROKEN,
    [ActionCancelReason.TARGET_LOST]: MessageKey.CANCEL_TARGET_LOST,
    [ActionCancelReason.INTERRUPTED]: MessageKey.CANCEL_INTERRUPTED,
};

export const ValidationLogic = {
    /**
     * 指定されたエンティティのアクションがキャンセルされるべきか判定する
     * @param {World} world 
     * @param {number} entityId 
     * @returns {{ shouldCancel: boolean, reason: string|null }}
     */
    checkCancellation(world, entityId) {
        const action = world.getComponent(entityId, Action);
        const actorParts = world.getComponent(entityId, Parts);

        if (!action || !action.partKey || !actorParts) {
             return { shouldCancel: true, reason: ActionCancelReason.PART_BROKEN };
        }

        const partId = actorParts[action.partKey];
        const partData = BattleQueries.getPartData(world, partId);

        if (!partData || partData.isBroken) {
            return { shouldCancel: true, reason: ActionCancelReason.PART_BROKEN };
        }
        
        if (action.targetId !== null) {
            const targetParts = world.getComponent(action.targetId, Parts);
            if (!targetParts) {
                return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
            }
            
            const headData = BattleQueries.getPartData(world, targetParts.head);
            if (!headData || headData.isBroken) {
                return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
            }

            if (action.targetPartKey) {
                 const targetPartId = targetParts[action.targetPartKey];
                 const targetPartData = BattleQueries.getPartData(world, targetPartId);
                 if (!targetPartData || targetPartData.isBroken) {
                    return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
                 }
            }
        }

        return { shouldCancel: false, reason: null };
    },

    getCancelMessage(world, entityId, reason) {
        const actorInfo = world.getComponent(entityId, PlayerInfo);
        
        if (!actorInfo) return '';

        const messageKey = cancelReasonToMessageKey[reason] || MessageKey.CANCEL_INTERRUPTED;
        return MessageFormatter.format(messageKey, { actorName: actorInfo.name });
    }
};