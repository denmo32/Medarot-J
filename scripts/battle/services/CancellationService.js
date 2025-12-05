/**
 * @file CancellationService.js
 * @description アクションキャンセルの判定と処理を行うサービスクラス。
 * ActionCancellationSystemのロジックを移行し、静的メソッドとして提供する。
 */
import { GameEvents } from '../../common/events.js';
import { GameState, Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { PlayerStateType, ActionCancelReason, ModalType } from '../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { MessageGenerator } from '../utils/MessageGenerator.js';

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
        const gameState = world.getComponent(entityId, GameState);
        
        // チャージ中でない、または既にアクション実行待機状態の場合はキャンセル判定対象外とみなすこともできるが、
        // 実行直前のチェックとして利用するため、ステートに関わらずデータの整合性をチェックする。
        
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
     * キャンセル処理を実行（イベント発行）
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} reason 
     */
    static executeCancel(world, entityId, reason) {
        const messageGenerator = new MessageGenerator(world);

        // 1. システムへの通知
        world.emit(GameEvents.ACTION_CANCELLED, { entityId, reason });

        // 2. ユーザーへの通知 (メッセージ表示)
        const actorInfo = world.getComponent(entityId, PlayerInfo);
        if (actorInfo) {
            const messageKey = cancelReasonToMessageKey[reason] || MessageKey.CANCEL_INTERRUPTED;
            const message = messageGenerator.format(messageKey, { actorName: actorInfo.name });
            
            world.emit(GameEvents.SHOW_MODAL, {
                type: ModalType.MESSAGE,
                data: { message: message }
            });
        }
    }
}