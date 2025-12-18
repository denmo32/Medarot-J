/**
 * @file CancellationService.js
 * @description アクションキャンセル判定。
 * パーツIDの参照を修正。
 */
import { Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { ActionCancelReason } from '../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { MessageService } from './MessageService.js';
import { QueryService } from './QueryService.js';

const cancelReasonToMessageKey = {
    [ActionCancelReason.PART_BROKEN]: MessageKey.CANCEL_PART_BROKEN,
    [ActionCancelReason.TARGET_LOST]: MessageKey.CANCEL_TARGET_LOST,
    [ActionCancelReason.INTERRUPTED]: MessageKey.CANCEL_INTERRUPTED,
};

export class CancellationService {
    /**
     * 指定されたエンティティのアクションがキャンセルされるべきか判定する
     * @param {World} world 
     * @param {number} entityId 
     * @returns {{ shouldCancel: boolean, reason: string|null }}
     */
    static checkCancellation(world, entityId) {
        const action = world.getComponent(entityId, Action);
        const actorParts = world.getComponent(entityId, Parts);

        if (!action || !action.partKey || !actorParts) {
             return { shouldCancel: true, reason: ActionCancelReason.PART_BROKEN };
        }

        const partId = actorParts[action.partKey];
        const partData = QueryService.getPartData(world, partId);

        if (!partData || partData.isBroken) {
            return { shouldCancel: true, reason: ActionCancelReason.PART_BROKEN };
        }
        
        if (action.targetId !== null) {
            const targetParts = world.getComponent(action.targetId, Parts);
            if (!targetParts) {
                return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
            }
            
            const headData = QueryService.getPartData(world, targetParts.head);
            if (!headData || headData.isBroken) {
                return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
            }

            if (action.targetPartKey) {
                 const targetPartId = targetParts[action.targetPartKey];
                 const targetPartData = QueryService.getPartData(world, targetPartId);
                 if (!targetPartData || targetPartData.isBroken) {
                    return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
                 }
            }
        }

        return { shouldCancel: false, reason: null };
    }

    static getCancelMessage(world, entityId, reason) {
        const messageService = new MessageService(world);
        const actorInfo = world.getComponent(entityId, PlayerInfo);
        
        if (!actorInfo) return '';

        const messageKey = cancelReasonToMessageKey[reason] || MessageKey.CANCEL_INTERRUPTED;
        return messageService.format(messageKey, { actorName: actorInfo.name });
    }
}