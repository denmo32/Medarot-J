/**
 * @file BattleSequenceSystem.js
 * @description アクション実行シーケンスの制御を行う。
 * ターゲット解決ロジックをTargetingServiceに委譲し、責務を分離。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { BattleContext } from '../../context/index.js';
import { GameState, Action } from '../../components/index.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';
import { BattleResolver } from '../../logic/BattleResolver.js';
import { EffectApplier } from '../../logic/EffectApplier.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';

import { CooldownService } from '../../services/CooldownService.js';
import { CancellationService } from '../../services/CancellationService.js';
import { PlayerStatusService } from '../../services/PlayerStatusService.js';
import { TargetingService } from '../../services/TargetingService.js';

export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.battleResolver = new BattleResolver(world);
        this.timelineBuilder = new TimelineBuilder(world);
        this.taskRunner = new TaskRunner(world);
        
        this.executionQueue = [];
        this.currentActorId = null;
        
        this.on(GameEvents.ACTION_EXECUTION_COMPLETED, this.onActionExecutionCompleted.bind(this));
        this.on(GameEvents.ACTION_EXECUTION_REQUESTED, this.onActionExecutionRequested.bind(this));
        
        this.on(GameEvents.REQUEST_RESET_TO_COOLDOWN, this.onRequestResetToCooldown.bind(this));
        this.on(GameEvents.CHECK_ACTION_CANCELLATION, this.onCheckActionCancellation.bind(this));
    }

    onActionExecutionRequested() {
        if (this.currentActorId !== null || this.executionQueue.length > 0) {
            return;
        }
        
        this._populateExecutionQueueFromReady();
        this._processNextInQueue();
    }

    update(deltaTime) {
        this.taskRunner.update(deltaTime);
        this.battleContext.isSequenceRunning = !this.taskRunner.isIdle;

        if (this.taskRunner.isIdle && this.currentActorId !== null) {
            this._finishCurrentActorSequence();
        }
    }
    
    _finishCurrentActorSequence() {
        this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: this.currentActorId });
        this.currentActorId = null;
        this._processNextInQueue();
    }
    
    _processNextInQueue() {
        if (this.executionQueue.length > 0) {
            this._startNextActionSequence();
        } else {
            if (!this.battleContext.isSequenceRunning) {
                this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
            }
        }
    }

    _reset() {
        this.executionQueue = [];
        this.currentActorId = null;
        this.taskRunner.clear();
        this.battleContext.isSequenceRunning = false;
    }

    _populateExecutionQueueFromReady() {
        const readyEntities = this.getEntities(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        readyEntities.sort(compareByPropulsion(this.world));
        this.executionQueue = readyEntities;
    }

    _startNextActionSequence() {
        const actorId = this.executionQueue.shift();
        if (!this.isValidEntity(actorId)) {
            this._processNextInQueue();
            return;
        }

        this.currentActorId = actorId;
        const actionComp = this.world.getComponent(actorId, Action);

        // 状態遷移: アニメーション待機へ
        PlayerStatusService.transitionTo(this.world, actorId, PlayerStateType.AWAITING_ANIMATION);

        // 1. 実行直前のキャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            CancellationService.executeCancel(this.world, actorId, cancelCheck.reason);
            CooldownService.resetEntityStateToCooldown(this.world, actorId, { interrupted: true });
            return;
        }

        // 2. 移動後ターゲット決定 (TargetingServiceに委譲)
        TargetingService.resolvePostMoveTarget(this.world, actorId, actionComp);

        // 3. 戦闘結果の計算 (Logic)
        const resultData = this.battleResolver.resolve(actorId);

        // 4. Logicデータの即時更新 (副作用の適用)
        EffectApplier.applyResult(this.world, resultData);
        
        this.world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, resultData);

        // 5. 演出タスクの構築と実行 (Visual)
        const tasks = this.timelineBuilder.buildAttackSequence(resultData);
        
        this.taskRunner.addTasks(tasks);
        this.battleContext.isSequenceRunning = true;
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

    onActionExecutionCompleted() {
        this._reset();
    }
}