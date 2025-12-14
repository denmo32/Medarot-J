/**
 * @file TurnSystem.js
 * @description ターン更新の管理システム。
 * 旧 TurnStartState, TurnEndState のロジックを統合。
 */
import { System } from '../../../../engine/core/System.js';
import { GameState } from '../../components/index.js';
import { TurnContext } from '../../components/TurnContext.js';
import { PhaseContext } from '../../components/PhaseContext.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { QueryService } from '../../services/QueryService.js';

export class TurnSystem extends System {
    constructor(world) {
        super(world);
        this.turnContext = this.world.getSingletonComponent(TurnContext);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        this.pendingQueue = [];
        
        this.lastPhase = null;

        this.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
    }

    update(deltaTime) {
        // --- フェーズ遷移検知 ---
        if (this.phaseContext.phase !== this.lastPhase) {
            this._onPhaseEnter(this.phaseContext.phase);
            this.lastPhase = this.phaseContext.phase;
        }

        // --- Queue Processing (ACTION_SELECTION / INITIAL_SELECTION) ---
        if (this.pendingQueue.length > 0) {
            if (this.phaseContext.phase === BattlePhase.INITIAL_SELECTION) {
                this.pendingQueue.sort((a, b) => a - b);
            } else {
                this.pendingQueue.sort(QueryService.compareByPropulsion(this.world));
            }

            this.turnContext.actionQueue.push(...this.pendingQueue);
            this.pendingQueue = [];
        }

        const activePhases = [
            BattlePhase.ACTION_SELECTION,
            BattlePhase.INITIAL_SELECTION
        ];
        if (!activePhases.includes(this.phaseContext.phase)) {
            return;
        }

        if (this.turnContext.currentActorId === null && this.turnContext.actionQueue.length > 0) {
            const nextActorId = this.turnContext.actionQueue.shift();

            const gameState = this.world.getComponent(nextActorId, GameState);
            if (gameState && gameState.state === PlayerStateType.READY_SELECT) {
                this.world.emit(GameEvents.NEXT_ACTOR_DETERMINED, { entityId: nextActorId });
            }
        }
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
        // ターン終了イベント発行 (EffectSystemなどがリッスン)
        this.world.emit(GameEvents.TURN_END, { turnNumber: this.turnContext.number - 1 });
        
        // 次のターン開始イベント発行
        this.world.emit(GameEvents.TURN_START, { turnNumber: this.turnContext.number });
        
        // ターン開始フェーズへ
        this.phaseContext.phase = BattlePhase.TURN_START;
    }

    _handleTurnStart() {
        // TurnSystem等は毎フレーム動作しているため、特別な処理は不要。
        // 即座にアクション選択フェーズへ移行する
        this.phaseContext.phase = BattlePhase.ACTION_SELECTION;
    }

    onActionQueueRequest(detail) {
        const { entityId } = detail;
        if (!this.pendingQueue.includes(entityId) && !this.turnContext.actionQueue.includes(entityId)) {
            this.pendingQueue.push(entityId);
        }
    }

    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        if (!this.turnContext.actionQueue.includes(entityId)) {
            this.turnContext.actionQueue.unshift(entityId);
        }
    }
}