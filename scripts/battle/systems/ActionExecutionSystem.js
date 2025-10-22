/**
 * @file ActionExecutionSystem.js (新規作成)
 * @description 行動実行フェーズの管理を担当するシステム。
 * BattleContextに格納されたアクションを順番に実行し、アニメーションを要求する。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { Action, GameState, Parts } from '../core/components/index.js';
import { BattlePhase, PlayerStateType, TargetTiming } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { postMoveTargetingStrategies } from '../ai/postMoveTargetingStrategies.js';

export class ActionExecutionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.executionQueue = [];
        this.isExecuting = false;
        this.currentExecutingActorId = null;

        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onAnimationCompleted.bind(this));
    }

    update(deltaTime) {
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            // [改善案] フェーズが切り替わったら内部状態をリセット
            if (this.executionQueue.length > 0 || this.isExecuting) {
                this.executionQueue = [];
                this.isExecuting = false;
                this.currentExecutingActorId = null;
            }
            return;
        }

        // 実行キューが空で、かつまだアクションを実行中でなければ、実行準備完了のエンティティからキューを生成
        if (this.executionQueue.length === 0 && !this.isExecuting) {
            this.populateExecutionQueueFromReady();
            // キューを生成しても実行対象がいない場合
            if (this.executionQueue.length === 0) {
                // [改善案] 実行対象がいない場合、このフェーズは完了したとみなし、完了イベントを発行
                // PhaseSystemが次のフェーズへ遷移させる
                this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
                return;
            }
        }

        // 実行中でなく、キューにアクションがあれば次のアクションを実行
        if (!this.isExecuting && this.executionQueue.length > 0) {
            this.executeNextAction();
        }
    }
    
    /**
     * READY_EXECUTE状態のエンティティから実行キューを作成する
     */
    populateExecutionQueueFromReady() {
        const readyEntities = this.world.getEntitiesWith(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        // TODO: 素早さ順にソート
        
        // Actionコンポーネントからアクション詳細を取得してキューに追加
        this.executionQueue = readyEntities.map(id => {
            const action = this.world.getComponent(id, Action);
            return {
                entityId: id,
                partKey: action.partKey,
                targetId: action.targetId,
                targetPartKey: action.targetPartKey
            };
        });
    }

    executeNextAction() {
        const actionDetail = this.executionQueue.shift();
        if (!actionDetail) {
            this.isExecuting = false;
            return;
        }

        this.isExecuting = true;
        const { entityId } = actionDetail;
        this.currentExecutingActorId = entityId;
        
        const actionComp = this.world.getComponent(entityId, Action);
        Object.assign(actionComp, actionDetail);

        this.determinePostMoveTarget(entityId);

        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState) gameState.state = PlayerStateType.AWAITING_ANIMATION;

        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
            attackerId: entityId,
            targetId: actionComp.targetId
        });
    }

    onAnimationCompleted(detail) {
        if (this.isExecuting && this.currentExecutingActorId === detail.entityId) {
            // 解決フェーズに渡すために、完了したアクションをコンテキストに記録
            this.battleContext.turn.resolvedActions.push({ entityId: detail.entityId });
            this.isExecuting = false;
            this.currentExecutingActorId = null;
        }
    }
    
    determinePostMoveTarget(executorId) {
        const action = this.world.getComponent(executorId, Action);
        const parts = this.world.getComponent(executorId, Parts);
        const selectedPart = parts[action.partKey];

        if (selectedPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
            const strategy = postMoveTargetingStrategies[selectedPart.postMoveTargeting];
            if (strategy) {
                const targetData = strategy({ world: this.world, attackerId: executorId });
                if (targetData) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                }
            }
        }
    }
}