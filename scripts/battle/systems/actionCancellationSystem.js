/**
 * @file アクションキャンセルシステム
 * このファイルは、予約されたアクションが実行不可能になったかどうかを判定し、
 * キャンセル処理を開始する責務を持ちます。
 * StateSystemからロジックを分離するために新設されました。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { GameState, Action, Parts } from '../core/components/index.js';
import { PlayerStateType, PartInfo } from '../common/constants.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * 行動予約のキャンセル判定に特化したシステム。
 * StateSystemが担っていた能動的な監視・判断ロジックを移譲されました。
 */
export class ActionCancellationSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // パーツ破壊イベントを購読し、キャンセル判定のトリガーとします。
        this.world.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
    }

    /**
     * パーツが破壊された際に呼び出され、関連する行動予約のキャンセルを検討します。
     * @param {object} detail - PART_BROKEN イベントのペイロード { entityId, partKey }
     */
    onPartBroken(detail) {
        try {
            const { entityId: brokenEntityId, partKey: brokenPartKey } = detail;

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
                    // キャンセルイベントを発行し、後続処理(メッセージ生成、状態遷移)を他のシステムに委譲します。
                    this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: 'PART_BROKEN' });
                    continue; // このアクターに対する処理は完了
                }
                
                // 判定2: ターゲットが機能停止した場合 (頭部破壊)
                // selectedPartが存在し、かつ単体対象のアクションの場合のみチェック
                if (selectedPart && selectedPart.targetScope?.endsWith('_SINGLE') &&
                    action.targetId === brokenEntityId && 
                    brokenPartKey === PartInfo.HEAD.key) 
                {
                    this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: 'TARGET_LOST' });
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'onPartBroken', detail });
        }
    }

    update(deltaTime) {
        // このシステムはイベント駆動のため、update処理は不要です。
    }
}