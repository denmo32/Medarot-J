/**
 * @file ActionSelectionSystem.js
 * @description 行動選択フェーズの管理を担当するシステム。
 * プレイヤー入力(InputSystem)とAI思考(AiSystem)を調整し、
 * 選択されたアクションをBattleContextに格納する。
 */
import { BaseSystem } from '../../../engine/baseSystem.js';
import { BattleContext } from '../../context/index.js';
import { GameState, PlayerInfo } from '../../components/index.js';
import { BattlePhase, PlayerStateType } from '../../common/constants.js';
import { GameEvents } from '../../common/events.js';

export class ActionSelectionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // プレイヤーまたはAIが行動を決定したイベントを購読
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        // TurnSystemから次のアクターが決定した通知を購読
        this.world.on(GameEvents.NEXT_ACTOR_DETERMINED, this.onNextActorDetermined.bind(this));
    }

    update(deltaTime) {
        // TurnSystemへの参照解決ロジックを削除

        const activePhases = [
            BattlePhase.ACTION_SELECTION,
            BattlePhase.INITIAL_SELECTION 
        ];
        if (!activePhases.includes(this.battleContext.phase)) {
            return;
        }

        // キューからのアクター取り出しロジックをTurnSystemに移管。
        // このupdateでは、キューが空になったことを検知してフェーズ完了を通知する責務のみ残す。
        // TurnSystemへの直接参照を削除し、BattleContextの共有状態を参照する
        if (this.battleContext.turn.currentActorId === null && this.battleContext.turn.actionQueue.length === 0) {
            // 行動キューが空で、現在のアクターもいない場合、選択フェーズ完了とみなす
            if (this.battleContext.phase === BattlePhase.ACTION_SELECTION) {
                this.world.emit(GameEvents.ACTION_SELECTION_COMPLETED);
            }
        }
    }

    /**
     * 次のアクターが決定した際のハンドラ
     * @param {object} detail - { entityId }
     */
    onNextActorDetermined(detail) {
        const { entityId } = detail;
        this.battleContext.turn.currentActorId = entityId;
        this.triggerActionSelection(entityId);
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
