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
        this.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
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

    update(deltaTime) {
        if (this.pendingQueue.length > 0) {
            if (this.phaseContext.phase === BattlePhase.INITIAL_SELECTION) {
                this.pendingQueue.sort((a, b) => a - b);
            } else {
                this.pendingQueue.sort(QueryService.compareByPropulsion(this.world));
            }

            this.turnContext.actionQueue.push(...this.pendingQueue);
            this.pendingQueue = [];
        }

        // フェーズチェックを削除（または現在のフェーズがアクション受付可能かだけチェック）
        // 厳密には ActionSelectionState がアクティブな時だけ処理したいが、
        // システム間結合を疎にするため、ここではフェーズ定数でのチェックに留める。
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
}