/**
 * @file CancellationService.js
 * @description アクションキャンセルの判定ロジックを提供する純粋なサービス。
 * PlayerInfoのインポート漏れを修正。
 */
import { Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { ActionCancelReason } from '../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { MessageService } from './MessageService.js';

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

        // 1. 自分の使用しようとしているパーツが破壊されているか確認
        if (!action.partKey || !actorParts[action.partKey] || actorParts[action.partKey].isBroken) {
            return { shouldCancel: true, reason: ActionCancelReason.PART_BROKEN };
        }
        
        // 2. ターゲットに関する破壊確認
        if (action.targetId !== null) {
            const targetParts = world.getComponent(action.targetId, Parts);
            
            // ターゲットが存在しない、または機能停止している(頭部破壊)場合
            if (!targetParts || (targetParts.head && targetParts.head.isBroken)) {
                return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
            }

            // 特定のパーツ狙いで、そのパーツが破壊された場合
            if (action.targetPartKey) {
                 const targetPart = targetParts[action.targetPartKey];
                 if (targetPart && targetPart.isBroken) {
                    return { shouldCancel: true, reason: ActionCancelReason.TARGET_LOST };
                 }
            }
        }

        return { shouldCancel: false, reason: null };
    }

    /**
     * キャンセル理由に対応するメッセージを取得する
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} reason 
     * @returns {string} フォーマット済みメッセージ
     */
    static getCancelMessage(world, entityId, reason) {
        const messageService = new MessageService(world);
        const actorInfo = world.getComponent(entityId, PlayerInfo);
        
        if (!actorInfo) return '';

        const messageKey = cancelReasonToMessageKey[reason] || MessageKey.CANCEL_INTERRUPTED;
        return messageService.format(messageKey, { actorName: actorInfo.name });
    }
}