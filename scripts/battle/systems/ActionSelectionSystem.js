/**
 * @file ActionSelectionSystem.js
 * @description 行動選択フェーズの管理を担当するシステム。
 * プレイヤー入力(InputSystem)とAI思考(AiSystem)を調整し、
 * 選択されたアクションをBattleContextに格納する。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { GameState, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, PlayerStateType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { TurnSystem } from './turnSystem.js';

export class ActionSelectionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // コンストラクタ実行時点では他のシステムが登録されていないため、nullで初期化します。
        // 実際の参照は、全システムが登録された後の最初のupdate時に解決します。
        this.turnSystem = null;

        // プレイヤーまたはAIが行動を決定したイベントを購読
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
    }

    update(deltaTime) {
        // 初回のupdate実行時にTurnSystemへの参照を安全に取得します。
        if (!this.turnSystem) {
            this.turnSystem = this.world.systems.find(s => s instanceof TurnSystem);
            if (!this.turnSystem) {
                // このエラーが出た場合、TurnSystemがsystemInitializer.jsに登録されていないことを意味します。
                console.error("ActionSelectionSystem could not find the TurnSystem. Ensure it is registered in systemInitializer.js.");
                return;
            }
        }

        // このシステムが動作するべきフェーズに INITIAL_SELECTION を追加します。
        // これにより、バトル開始直後の最初の行動選択が正しくトリガーされます。
        const activePhases = [
            BattlePhase.ACTION_SELECTION,
            BattlePhase.INITIAL_SELECTION 
        ];
        if (!activePhases.includes(this.battleContext.phase)) {
            return;
        }

        // 現在行動すべきアクターがいない場合、ターンキューから次のアクターを取り出す
        if (this.battleContext.turn.currentActorId === null) {
            // TurnSystemのキューを直接参照して処理します。
            if (this.turnSystem && this.turnSystem.actionQueue.length > 0) {
                const nextActorId = this.turnSystem.actionQueue.shift();
                
                // 行動可能か最終チェック
                const gameState = this.world.getComponent(nextActorId, GameState);
                if (gameState && gameState.state === PlayerStateType.READY_SELECT) {
                    this.battleContext.turn.currentActorId = nextActorId;
                    this.triggerActionSelection(nextActorId);
                }
            } else if (this.turnSystem && this.turnSystem.actionQueue.length === 0) {
                // 行動キューが空で、現在のアクターもいない場合、選択フェーズ完了とみなす
                // INITIAL_SELECTIONフェーズでは、完了判定はPhaseSystemが担当するため、
                // ACTION_SELECTIONフェーズでのみ完了イベントを発行する。
                if (this.battleContext.phase === BattlePhase.ACTION_SELECTION) {
                    this.world.emit(GameEvents.ACTION_SELECTION_COMPLETED);
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