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
 */
export class TurnSystem extends BaseSystem {
    constructor(world) {
        super(world);
        
        this.actionQueue = [];
        
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.isPaused = false;
        
        this.world.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));

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
     * 毎フレーム実行され、行動キューを処理します。
     */
    update(deltaTime) {
        try {
            // [修正] TurnSystemが動作するフェーズを拡大。BATTLE_START以降、GAME_OVER前まで動作するようにする。
            const activePhases = [
                BattlePhase.INITIAL_SELECTION,
                BattlePhase.TURN_START,
                BattlePhase.ACTION_SELECTION,
                BattlePhase.ACTION_EXECUTION,
                BattlePhase.ACTION_RESOLUTION,
                BattlePhase.TURN_END,
            ];
            if (!activePhases.includes(this.battleContext.phase)) {
                return;
            }

            if (this.actionQueue.length === 0 || this.isPaused) {
                return;
            }
            
            // [修正] ACTION_SELECTIONフェーズでのみキューを処理するように限定。
            // これにより、他のフェーズで意図せず行動選択が開始されるのを防ぐ。
            if (this.battleContext.phase !== BattlePhase.ACTION_SELECTION && this.battleContext.phase !== BattlePhase.INITIAL_SELECTION) {
                return;
            }

            const entityId = this.actionQueue.shift();

            const gameState = this.world.getComponent(entityId, GameState);
            const parts = this.world.getComponent(entityId, Parts);

            if (gameState.state !== PlayerStateType.READY_SELECT || parts[PartInfo.HEAD.key]?.isBroken) {
                return;
            }
            
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);
            
            const eventToEmit = playerInfo.teamId === TeamID.TEAM1 
                ? GameEvents.PLAYER_INPUT_REQUIRED 
                : GameEvents.AI_ACTION_REQUIRED;
            
            this.world.emit(eventToEmit, { entityId });
        } catch (error) {
            ErrorHandler.handle(error, { method: 'TurnSystem.update', deltaTime });
        }
    }
    
    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}