/**
 * @file BattleSequenceSystem.js
 * @description イベント発行をここで行うように修正。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { BattleContext } from '../../components/BattleContext.js';
import { GameState, Action } from '../../components/index.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { ActionSequenceService } from '../../services/ActionSequenceService.js';
import { CooldownService } from '../../services/CooldownService.js';
import { CancellationService } from '../../services/CancellationService.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.service = new ActionSequenceService(world);
        this.taskRunner = new TaskRunner(world);
        
        this.executionQueue = [];
        this.isLoopRunning = false;

        // イベントリスナーの登録
        // this.onActionExecutionRequested が確実に存在することを確認
        this.on(GameEvents.ACTION_EXECUTION_REQUESTED, this.onActionExecutionRequested.bind(this));
        
        this.on(GameEvents.REQUEST_RESET_TO_COOLDOWN, this.onRequestResetToCooldown.bind(this));
        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
        this.on(GameEvents.GAME_OVER, this.abortSequence.bind(this));
    }

    async onActionExecutionRequested() {
        if (this.isLoopRunning || this.executionQueue.length > 0) {
            return;
        }

        // 実行対象の収集とソート
        this.executionQueue = this.service.getSortedReadyEntities();
        
        if (this.executionQueue.length === 0) {
            this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
            return;
        }

        this.isLoopRunning = true;
        this.battleContext.isSequenceRunning = true;

        try {
            await this.processExecutionQueue();
        } finally {
            this.isLoopRunning = false;
            this.battleContext.isSequenceRunning = false;
            // 全ての処理が完了
            this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
        }
    }

    /**
     * キュー内の全アクターのアクションを順次処理する
     */
    async processExecutionQueue() {
        while (this.executionQueue.length > 0) {
            // シーン遷移などで中断されていたらループを抜ける
            if (!this.isValidState()) break;

            const actorId = this.executionQueue.shift();

            // エンティティが既に削除されている等の場合はスキップ
            if (!this.isValidEntity(actorId)) continue;
            
            this.battleContext.turn.currentActorId = actorId;

            await this.executeActorSequence(actorId);

            this.battleContext.turn.currentActorId = null;
            this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: actorId });
        }
    }

    async executeActorSequence(actorId) {
        const { tasks, isCancelled, eventsToEmit } = this.service.executeSequence(actorId);

        // 副作用(イベント発行)を一括実行
        if (eventsToEmit) {
            eventsToEmit.forEach(event => {
                this.world.emit(event.type, event.payload);
            });
        }

        if (isCancelled) {
            return;
        }

        if (tasks.length > 0) {
            await this.taskRunner.run(tasks);
        }
    }

    isValidState() {
        return this.battleContext.phase !== 'GAME_OVER';
    }

    abortSequence() {
        this.executionQueue = [];
        this.taskRunner.abort();
        this.isLoopRunning = false;
        this.battleContext.isSequenceRunning = false;
    }

    update(deltaTime) {
        // TaskRunnerのフレーム更新（MoveTaskなどのため）
        this.taskRunner.update(deltaTime);
    }

    onRequestResetToCooldown(detail) {
        const { entityId, options } = detail;
        CooldownService.resetEntityStateToCooldown(this.world, entityId, options);
    }
    
    onCheckActionCancellation() {
        const actors = this.getEntities(GameState, Action);
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) continue;
            
            const check = CancellationService.checkCancellation(this.world, actorId);
            if (check.shouldCancel) {
                CancellationService.executeCancel(this.world, actorId, check.reason);
                CooldownService.resetEntityStateToCooldown(this.world, actorId, { interrupted: true });
            }
        }
    }
}