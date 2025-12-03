/**
 * @file BattleSequenceSystem.js
 * @description アクション実行シーケンスの制御を行う。
 * Serviceを利用してシステム間連携を直接的に行い、Logicデータの即時更新とVisual演出の再生を管理する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, PlayerStateType } from '../../common/constants.js';
import { BattleContext } from '../../context/index.js';
import { GameState, Action } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';
import { BattleResolver } from '../../logic/BattleResolver.js';
import { TaskRunner } from '../../tasks/TaskRunner.js';
import { TimelineBuilder } from '../../tasks/TimelineBuilder.js';
import { TargetTiming, EffectType } from '../../../common/constants.js';

// Services
import { CooldownService } from '../../services/CooldownService.js';
import { CancellationService } from '../../services/CancellationService.js';

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
        
        // 次へ
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
        this.world.emit(GameEvents.REQUEST_STATE_TRANSITION, { entityId: actorId, newState: PlayerStateType.AWAITING_ANIMATION });

        // 1. 実行直前のキャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            CancellationService.executeCancel(this.world, actorId, cancelCheck.reason);
            CooldownService.resetEntityStateToCooldown(this.world, actorId, { interrupted: true });
            return;
        }

        // 2. 移動後ターゲット決定
        this._determinePostMoveTarget(actorId, actionComp);

        // 3. 戦闘結果の計算 (Logic)
        const resultData = this.battleResolver.resolve(actorId);

        // 4. Logicデータの即時更新 (副作用の適用)
        this._applyLogicUpdate(resultData);

        // 5. 演出タスクの構築と実行 (Visual)
        const tasks = this.timelineBuilder.buildAttackSequence(resultData);
        
        this.taskRunner.addTasks(tasks);
        this.battleContext.isSequenceRunning = true;
    }

    _applyLogicUpdate(resultData) {
        const { appliedEffects } = resultData;
        
        if (appliedEffects) {
            appliedEffects.forEach(effect => {
                // HPの更新
                if (effect.type === EffectType.DAMAGE || effect.type === EffectType.HEAL) {
                    const parts = this.world.getComponent(effect.targetId, Parts);
                    if (parts && parts[effect.partKey]) {
                        // Logicデータ(Parts)を即時更新
                        parts[effect.partKey].hp = effect.newHp;
                        
                        // パーツ破壊フラグの更新
                        if (effect.isPartBroken) {
                            parts[effect.partKey].isBroken = true;
                            this.world.emit(GameEvents.PART_BROKEN, { entityId: effect.targetId, partKey: effect.partKey });
                        }
                    }
                }
                // その他の副作用（イベント発行など）
                if (effect.events) {
                    effect.events.forEach(e => this.world.emit(e.type, e.payload));
                }
            });
        }

        // 重要: ロジック更新完了を通知
        // これにより StateSystem が GUARDING への遷移を行ったり、
        // BattleHistorySystem が履歴を記録したりする。
        this.world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, resultData);
    }

    _determinePostMoveTarget(executorId, action) {
        const parts = this.world.getComponent(executorId, Parts);
        if (!parts || !action.partKey) return;
        
        const selectedPart = parts[action.partKey];

        if (selectedPart && selectedPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
            const strategy = targetingStrategies[selectedPart.postMoveTargeting];
            if (strategy) {
                const targetData = strategy({ world: this.world, attackerId: executorId });
                if (targetData) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                }
            }
        }
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