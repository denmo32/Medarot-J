/**
 * @file 行動順序決定システム
 * このファイルは、ゲーム内でのエンティティ（キャラクター）の行動順を管理する責務を持ちます。
 */

import { BaseSystem } from '../../../engine/baseSystem.js';
import { GameState, PlayerInfo, Parts } from '../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, TeamID, BattlePhase, PartInfo } from '../../common/constants.js';
import { ErrorHandler } from '../../../engine/utils/ErrorHandler.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';

/**
 * ゲームの「ターン」や行動順を管理するシステム。
 * このシステムは行動キューの管理に専念し、イベント駆動で動作します。
 * 実際の行動選択のトリガーはActionSelectionSystemが担当します。
 */
export class TurnSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // ローカルのactionQueueを廃止し、BattleContextのキューを信頼できる唯一の情報源とする
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        // 同一フレームで行動可能になったエンティティを一時的に保持するキュー
        this.pendingQueue = [];
        this.world.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.world.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
    }

    /**
     * StateSystemから「行動可能になった」という通知を受け、エンティティを行動キューの末尾に追加します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionQueueRequest(detail) {
        const { entityId } = detail;
        // 直接 actionQueue に追加せず、保留キューに追加する
        if (!this.pendingQueue.includes(entityId) && !this.battleContext.turn.actionQueue.includes(entityId)) {
            this.pendingQueue.push(entityId);
        }
    }
    
    /**
     * StateSystemから「無効な行動が選択された」等の通知を受け、エンティティを行動キューの先頭に追加します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        // BattleContextのキューを直接操作する
        if (!this.battleContext.turn.actionQueue.includes(entityId)) {
            this.battleContext.turn.actionQueue.unshift(entityId);
        }
    }

    /**
     * updateロジックを復活させ、キューからアクターを決定する責務を担う。
     * このシステムのupdateロジックはActionSelectionSystemから移管されました。
     */
    update(deltaTime) {
        try {
            // 保留キューの処理
            if (this.pendingQueue.length > 0) {
                // 現在のフェーズに応じてソート戦略を決定
                if (this.battleContext.phase === BattlePhase.INITIAL_SELECTION) {
                    // 初回行動選択時はエンティティIDの昇順でソート
                    this.pendingQueue.sort((a, b) => a - b);
                } else {
                    // 通常時は脚部パーツの「推進」が高い順にソート
                    this.pendingQueue.sort(compareByPropulsion(this.world));
                }
                
                // ソート済みのエンティティを正式な行動キューに追加
                this.battleContext.turn.actionQueue.push(...this.pendingQueue);
                // 保留キューをクリア
                this.pendingQueue = [];
            }


            // 行動選択フェーズでのみ動作
            const activePhases = [
                BattlePhase.ACTION_SELECTION,
                BattlePhase.INITIAL_SELECTION 
            ];
            if (!activePhases.includes(this.battleContext.phase)) {
                return;
            }

            // 現在行動すべきアクターがおらず、キューに待機者がいる場合
            // BattleContextのキューを参照
            if (this.battleContext.turn.currentActorId === null && this.battleContext.turn.actionQueue.length > 0) {
                const nextActorId = this.battleContext.turn.actionQueue.shift();
                
                // 行動可能か最終チェック
                const gameState = this.world.getComponent(nextActorId, GameState);
                if (gameState && gameState.state === PlayerStateType.READY_SELECT) {
                    // ActionSelectionSystemに次のアクターを通知
                    this.world.emit(GameEvents.NEXT_ACTOR_DETERMINED, { entityId: nextActorId });
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'TurnSystem.update' });
        }
    }
}