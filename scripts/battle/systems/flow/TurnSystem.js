/**
 * @file TurnSystem.js
 * @description ターン更新の管理システム。
 * PhaseContext -> PhaseState へ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { GameState, ActionSelectionPending } from '../../components/index.js'; 
import { TurnContext } from '../../components/TurnContext.js';
import { PhaseState } from '../../components/PhaseState.js'; // 修正
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { QueryService } from '../../services/QueryService.js';

export class TurnSystem extends System {
    constructor(world) {
        super(world);
        this.turnContext = this.world.getSingletonComponent(TurnContext);
        this.phaseState = this.world.getSingletonComponent(PhaseState); // 修正
        
        this.lastPhase = null;

        this.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
    }

    update(deltaTime) {
        // --- フェーズ遷移検知 ---
        if (this.phaseState.phase !== this.lastPhase) { // 修正
            this._onPhaseEnter(this.phaseState.phase); // 修正
            this.lastPhase = this.phaseState.phase; // 修正
        }

        const activePhases = [
            BattlePhase.ACTION_SELECTION,
            BattlePhase.INITIAL_SELECTION
        ];
        if (!activePhases.includes(this.phaseState.phase)) { // 修正
            return;
        }

        // --- 次のアクター決定ロジック ---
        // 現在誰も選択中でない場合のみ処理
        if (this.turnContext.currentActorId === null) {
            const nextActorId = this._getNextPendingActor();
            
            if (nextActorId !== null) {
                // 選択権を付与したとみなし、Pendingタグを外す
                this.world.removeComponent(nextActorId, ActionSelectionPending);
                
                // イベント発行
                this.world.emit(GameEvents.NEXT_ACTOR_DETERMINED, { entityId: nextActorId });
            }
        }
    }

    _getNextPendingActor() {
        const pendingEntities = this.getEntities(ActionSelectionPending);
        if (pendingEntities.length === 0) return null;

        // 状態チェック: READY_SELECT でないものは除外（念のため）
        const validEntities = pendingEntities.filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state && state.state === PlayerStateType.READY_SELECT;
        });

        if (validEntities.length === 0) return null;

        // ソート
        if (this.phaseState.phase === BattlePhase.INITIAL_SELECTION) { // 修正
            // ID順 (Entity IDは作成順なので数値昇順で代用)
            validEntities.sort((a, b) => a - b);
        } else {
            // 推進力順
            validEntities.sort(QueryService.compareByPropulsion(this.world));
        }

        return validEntities[0];
    }

    _onPhaseEnter(phase) {
        if (phase === BattlePhase.TURN_END) {
            this._handleTurnEnd();
        } else if (phase === BattlePhase.TURN_START) {
            this._handleTurnStart();
        }
    }

    _handleTurnEnd() {
        this.turnContext.number++;
        this.world.emit(GameEvents.TURN_END, { turnNumber: this.turnContext.number - 1 });
        this.world.emit(GameEvents.TURN_START, { turnNumber: this.turnContext.number });
        this.phaseState.phase = BattlePhase.TURN_START; // 修正
    }

    _handleTurnStart() {
        this.phaseState.phase = BattlePhase.ACTION_SELECTION; // 修正
    }

    onActionQueueRequest(detail) {
        const { entityId } = detail;
        if (!this.world.getComponent(entityId, ActionSelectionPending)) {
            this.world.addComponent(entityId, new ActionSelectionPending());
        }
    }

    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        if (!this.world.getComponent(entityId, ActionSelectionPending)) {
            this.world.addComponent(entityId, new ActionSelectionPending());
        }
    }
}