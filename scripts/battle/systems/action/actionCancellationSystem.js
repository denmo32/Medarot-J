import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { GameState, Action } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { PlayerStateType, ActionCancelReason } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js';

export class ActionCancellationSystem extends System {
    constructor(world) {
        super(world);
        // パーツ破壊イベントの直接監視を廃止し、シーケンス末尾でのチェックイベントを監視
        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
    }

    /**
     * アクションキャンセルが必要な状態が発生していないか一括チェックする
     * シーケンスの最後に呼び出されることを想定
     */
    onCheckActionCancellation() {
        const actors = this.getEntities(GameState, Action, Parts);
        
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            
            // チャージ中のアクションのみがキャンセルの対象
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) {
                continue;
            }

            const action = this.world.getComponent(actorId, Action);
            const actorParts = this.world.getComponent(actorId, Parts);

            // 1. 自分の使用しようとしているパーツが破壊されているか確認
            if (!action.partKey || !actorParts[action.partKey] || actorParts[action.partKey].isBroken) {
                this.emitCancellationEvents(actorId, ActionCancelReason.PART_BROKEN);
                continue;
            }
            
            // 2. ターゲットに関する破壊確認
            if (action.targetId !== null) {
                const targetParts = this.world.getComponent(action.targetId, Parts);
                
                // ターゲットが存在しない、または機能停止している(頭部破壊)場合
                if (!targetParts || (targetParts.head && targetParts.head.isBroken)) {
                    this.emitCancellationEvents(actorId, ActionCancelReason.TARGET_LOST);
                    continue;
                }

                // 特定のパーツ狙いで、そのパーツが破壊された場合
                if (action.targetPartKey) {
                     const targetPart = targetParts[action.targetPartKey];
                     if (targetPart && targetPart.isBroken) {
                        this.emitCancellationEvents(actorId, ActionCancelReason.TARGET_LOST);
                        continue;
                     }
                }
            }
        }
    }

    /**
     * キャンセル関連のイベントを発行するヘルパーメソッド
     * @param {number} entityId 
     * @param {ActionCancelReason} reason 
     */
    emitCancellationEvents(entityId, reason) {
        this.world.emit(GameEvents.ACTION_CANCELLED, { entityId, reason });
        this.world.emit(GameEvents.REQUEST_RESET_TO_COOLDOWN, { entityId, options: { interrupted: true } });
    }
}