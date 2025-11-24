/**
 * @file アクションキャンセルシステム
 * このファイルは、予約されたアクションが実行不可能になったかどうかを判定し、
 * キャンセル処理を開始する責務を持ちます。
 * StateSystemからロジックを分離するために新設されました。
 */
import { BaseSystem } from '../../../engine/baseSystem.js';
import { GameEvents } from '../../common/events.js';
import { GameState, Action, Parts } from '../../components/index.js';
import { PlayerStateType, PartInfo, ActionCancelReason } from '../../common/constants.js';
import { ErrorHandler } from '../../utils/errorHandler.js';

/**
 * 行動予約のキャンセル判定に特化したシステム。
 * StateSystemが担っていた能動的な監視・判断ロジックを移譲されました。
 */
export class ActionCancellationSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // HPバーアニメーション完了イベントを購読
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
    }

    /**
     * HPバーアニメーション完了後に呼び出され、関連する行動予約のキャンセルを検討します。
     * @param {object} detail - HP_BAR_ANIMATION_COMPLETED イベントのペイロード { appliedEffects }
     */
    onHpBarAnimationCompleted(detail) {
        try {
            const { appliedEffects } = detail;
            if (!appliedEffects) return;

            for (const effect of appliedEffects) {
                if (!effect.isPartBroken) continue;

                const { targetId: brokenEntityId, partKey: brokenPartKey } = effect;

                // 行動予約中(`SELECTED_CHARGING`)のエンティティのみをチェック対象とします。
                const actors = this.world.getEntitiesWith(GameState, Action, Parts);
                for (const actorId of actors) {
                    const gameState = this.world.getComponent(actorId, GameState);
                    if (gameState.state !== PlayerStateType.SELECTED_CHARGING) {
                        continue;
                    }

                    const action = this.world.getComponent(actorId, Action);
                    const actorParts = this.world.getComponent(actorId, Parts);
                    const selectedPart = actorParts[action.partKey];

                    // 判定1: 自身の予約パーツが破壊された場合
                    if (actorId === brokenEntityId && action.partKey === brokenPartKey) {
                        this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: ActionCancelReason.PART_BROKEN });
                        continue; // このアクターに対する処理は完了
                    }
                    
                    // 判定2: ターゲットが機能停止した場合 (頭部破壊)
                    // isPlayerBroken フラグで判定
                    if (effect.isPlayerBroken && selectedPart && selectedPart.targetScope?.endsWith('_SINGLE') && action.targetId === brokenEntityId) {
                        this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: ActionCancelReason.TARGET_LOST });
                        continue; // 重複キャンセルを防ぐ
                    }

                    // 判定3: ターゲットの特定のパーツが破壊された場合
                    if (selectedPart && selectedPart.targetScope?.endsWith('_SINGLE') && action.targetId === brokenEntityId && action.targetPartKey === brokenPartKey) {
                        this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: ActionCancelReason.TARGET_LOST });
                        continue; // このアクターに対する処理は完了
                    }
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'onHpBarAnimationCompleted', detail });
        }
    }
}
