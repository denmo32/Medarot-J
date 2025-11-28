import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { GameState, Action } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { PlayerStateType, ActionCancelReason } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js';

export class ActionCancellationSystem extends System {
    constructor(world) {
        super(world);
        // トリガーイベントをUIアニメーション完了から、より直接的なデータ変更イベントに変更
        this.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
    }

    /**
     * パーツ破壊イベントをハンドルし、関連するアクションをキャンセルする。
     * ターゲットの機能停止（頭部破壊）もここで検知する。
     * @param {{ entityId: number, partKey: string }} detail
     */
    onPartBroken(detail) {
        const { entityId: brokenEntityId, partKey: brokenPartKey } = detail;
        const isTargetDestroyed = brokenPartKey === PartInfo.HEAD.key;

        const actors = this.getEntities(GameState, Action, Parts);
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            // チャージ中のアクションのみがキャンセルの対象
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) {
                continue;
            }

            const action = this.world.getComponent(actorId, Action);
            const actorParts = this.world.getComponent(actorId, Parts);
            const selectedPart = actorParts[action.partKey];

            // 1. 自分の使用しようとしているパーツが破壊された場合
            if (actorId === brokenEntityId && action.partKey === brokenPartKey) {
                this.emitCancellationEvents(actorId, ActionCancelReason.PART_BROKEN);
                continue; // このアクターの処理は完了
            }
            
            // 2. ターゲットに関する破壊
            if (selectedPart?.targetScope?.endsWith('_SINGLE') && action.targetId === brokenEntityId) {
                // 2a. ターゲット自体が機能停止した場合（頭部破壊）
                if (isTargetDestroyed) {
                    this.emitCancellationEvents(actorId, ActionCancelReason.TARGET_LOST);
                    continue;
                }
                // 2b. ターゲットの特定のパーツが破壊された場合
                if (action.targetPartKey === brokenPartKey) {
                    this.emitCancellationEvents(actorId, ActionCancelReason.TARGET_LOST);
                    continue;
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