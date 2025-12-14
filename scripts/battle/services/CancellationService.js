/**
 * @file CancellationService.js
 * @description アクションキャンセルの判定と処理を行うサービスクラス。
 * イベント発行を廃止し、リクエストコンポーネントの生成へ移行。
 */
import { GameEvents } from '../../common/events.js';
import { GameState, Action } from '../components/index.js';
import { Parts, PlayerInfo } from '../../components/index.js';
import { PlayerStateType, ActionCancelReason, ModalType } from '../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { MessageService } from './MessageService.js';
import { ModalRequest } from '../components/Requests.js';

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

    /**
     * キャンセル処理を実行（即時リクエスト発行用）
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} reason 
     */
    static executeCancel(world, entityId, reason) {
        // 1. システムへの通知（これは他のシステムが購読している可能性があるためイベントとして残すか、専用コンポーネントにする）
        // ここではログ出力やデバッグ用途が強いためイベントのままにするが、ロジック依存がある場合はコンポーネント化推奨
        world.emit(GameEvents.ACTION_CANCELLED, { entityId, reason });

        // 2. ユーザーへの通知 (メッセージ表示リクエスト)
        const message = this.getCancelMessage(world, entityId, reason);
        if (message) {
            const reqEntity = world.createEntity();
            world.addComponent(reqEntity, new ModalRequest(
                ModalType.MESSAGE,
                { message: message },
                {
                    messageSequence: [{ text: message }],
                    priority: 'high'
                }
            ));
        }
    }
}