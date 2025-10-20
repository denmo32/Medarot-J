/**
 * @file ActionSelectionSystem.js (新規作成)
 * @description 行動選択フェーズの管理を担当するシステム。
 * プレイヤー入力(InputSystem)とAI思考(AiSystem)を調整し、
 * 選択されたアクションをBattleContextに格納する。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { GameState, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, PlayerStateType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';

export class ActionSelectionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // プレイヤーまたはAIが行動を決定したイベントを購読
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
    }

    update(deltaTime) {
        // このシステムはACTION_SELECTIONフェーズでのみアクティブ
        if (this.battleContext.phase !== BattlePhase.ACTION_SELECTION) {
            return;
        }

        // 現在行動すべきアクターがいない場合、ターンキューから次のアクターを取り出す
        if (this.battleContext.turn.currentActorId === null) {
            const turnSystem = this.world.systems.find(s => s.constructor.name === 'TurnSystem');
            if (turnSystem && turnSystem.actionQueue.length > 0) {
                const nextActorId = turnSystem.actionQueue.shift();
                
                // 行動可能か最終チェック
                const gameState = this.world.getComponent(nextActorId, GameState);
                if (gameState && gameState.state === PlayerStateType.READY_SELECT) {
                    this.battleContext.turn.currentActorId = nextActorId;
                    this.triggerActionSelection(nextActorId);
                }
            }
        }
    }

    /**
     * 指定されたアクターに行動選択を促すイベントを発行する。
     * @param {number} entityId 
     */
    triggerActionSelection(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const eventToEmit = playerInfo.teamId === 'team1' 
            ? GameEvents.PLAYER_INPUT_REQUIRED 
            : GameEvents.AI_ACTION_REQUIRED;
            
        this.world.emit(eventToEmit, { entityId });
    }

    /**
     * 行動が選択されたときのハンドラ。
     * 選択されたアクションをコンテキストに保存し、次のアクターの選択に移る。
     * @param {object} detail 
     */
    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;

        // 選択したのが現在のアクターであることを確認
        if (this.battleContext.turn.currentActorId === entityId) {
            this.battleContext.turn.selectedActions.set(entityId, detail);
            this.battleContext.turn.currentActorId = null; // 次のアクターの選択へ
        }
    }
}