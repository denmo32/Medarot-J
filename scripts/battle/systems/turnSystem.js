/**
 * @file 行動順序決定システム
 * このファイルは、ゲーム内でのエンティティ（キャラクター）の行動順を管理する責務を持ちます。
 */

import { BaseSystem } from '../../core/baseSystem.js';
import { GameState, PlayerInfo, Parts } from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType, TeamID, BattlePhase, PartInfo } from '../common/constants.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * ゲームの「ターン」や行動順を管理するシステム。
 * このシステムは行動キューの管理に専念し、イベント駆動で動作します。
 * 実際の行動選択のトリガーはActionSelectionSystemが担当します。
 */
export class TurnSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.actionQueue = [];
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.world.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.world.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
    }

    /**
     * StateSystemから「行動可能になった」という通知を受け、エンティティを行動キューの末尾に追加します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionQueueRequest(detail) {
        const { entityId } = detail;
        if (!this.actionQueue.includes(entityId)) {
            this.actionQueue.push(entityId);
        }
    }
    
    /**
     * StateSystemから「無効な行動が選択された」等の通知を受け、エンティティを行動キューの先頭に追加します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        if (!this.actionQueue.includes(entityId)) {
            this.actionQueue.unshift(entityId);
        }
    }

    /**
     * このシステムのupdateロジックはActionSelectionSystemに移管されました。
     * このシステムはイベントに応じてキューを操作するだけの、よりシンプルな責務を持ちます。
     */
    update(deltaTime) {
        // This system is now event-driven and does not require an update loop.
        // The ActionSelectionSystem is responsible for processing the actionQueue.
    }
}