// scripts/systems/turnSystem.js:

import { GameContext, GameState, PlayerInfo } from '../components.js';
import { GameEvents } from '../events.js';
import { PlayerStateType, TeamID } from '../constants.js';

/**
 * ★新規: ゲームの行動順を管理するシステム。
 * StateSystemから責務を分離し、誰が次に行動するかを決定することに特化しています。
 */
export class TurnSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(GameContext);
        
        // 行動選択待ちのプレイヤーを管理するキュー
        this.actionQueue = [];

        this.world.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.world.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
    }

    /**
     * StateSystemから発行されたイベントを受け、エンティティを行動キューの末尾に追加します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionQueueRequest(detail) {
        const { entityId } = detail;
        // まだキューに入っていなければ追加する (重複防止)
        if (!this.actionQueue.includes(entityId)) {
            this.actionQueue.push(entityId);
        }
    }
    
    /**
     * StateSystemから発行されたイベントを受け、エンティティを行動キューの先頭に追加します。
     * (例: 無効なアクションを選択してしまった場合など、即座に再選択を促すため)
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        // まだキューに入っていなければ追加する (重複防止)
        if (!this.actionQueue.includes(entityId)) {
            this.actionQueue.unshift(entityId);
        }
    }

    update(deltaTime) {
        // キューに待機者がいて、かつモーダル表示などでゲームが一時停止していない場合に実行
        if (this.actionQueue.length === 0 || this.context.isPausedByModal) {
            return;
        }
        
        // キューの先頭からエンティティを取り出す
        const entityId = this.actionQueue.shift();

        // 念のため、取り出したエンティティがまだ行動可能かチェック
        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState.state !== PlayerStateType.READY_SELECT) {
            // 行動できない状態になっていたら、キューの次の処理へ進む
            return;
        }
        
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        
        // チームIDに応じて、プレイヤー操作かAI操作かを判断し、適切なイベントを発行
        // これにより、InputSystemまたはAiSystemが起動します。
        const eventToEmit = playerInfo.teamId === TeamID.TEAM1 
            ? GameEvents.PLAYER_INPUT_REQUIRED 
            : GameEvents.AI_ACTION_REQUIRED;
        
        this.world.emit(eventToEmit, { entityId });
    }
}