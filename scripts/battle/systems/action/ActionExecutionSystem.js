/**
 * @file ActionExecutionSystem.js
 * @description 行動実行フェーズの管理を担当するシステム。
 * BattleContextに格納されたアクションを順番に実行し、アニメーションを要求する。
 */
import { BaseSystem } from '../../../engine/baseSystem.js';
import { BattleContext } from '../../context/index.js';
import { Action, GameState, Parts } from '../../components/index.js';
import { BattlePhase, PlayerStateType, TargetTiming, ModalType } from '../../common/constants.js';
import { GameEvents } from '../../common/events.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';
import { ErrorHandler } from '../../utils/errorHandler.js';

export class ActionExecutionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.executionQueue = [];
        this.isExecuting = false;
        this.currentExecutingActorId = null;

        // MODAL_SEQUENCE_COMPLETED の代わりに COMBAT_RESOLUTION_DISPLAYED を購読
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onAnimationCompleted.bind(this));
        this.world.on(GameEvents.COMBAT_RESOLUTION_DISPLAYED, this.onResolutionDisplayed.bind(this));
    }

    update(deltaTime) {
        try {
            if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
                // フェーズが切り替わったら内部状態をリセット
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
                    // 実行対象がいない場合、このフェーズは完了したとみなし、完了イベントを発行
                    // PhaseSystemが次のフェーズへ遷移させる
                    this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
                    return;
                }
            }

            // 実行中でなく、キューにアクションがあれば次のアクションを実行
            if (!this.isExecuting && this.executionQueue.length > 0) {
                this.executeNextAction();
            }
        } catch (error) {
            ErrorHandler.handle(error, { method: 'ActionExecutionSystem.update' });
            // エラー回復：強制的にフェーズ完了とみなす
            this.isExecuting = false;
            this.executionQueue = [];
            this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
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

        // 実行準備完了のエンティティを「推進」が高い順にソート
        readyEntities.sort(compareByPropulsion(this.world));
        
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

        try {
            this.determinePostMoveTarget(entityId);
        } catch (error) {
            ErrorHandler.handle(error, { method: 'ActionExecutionSystem.determinePostMoveTarget', entityId });
            // ターゲット決定失敗時はターゲットなしとして進行（空振りになる可能性が高い）
        }

        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState) gameState.state = PlayerStateType.AWAITING_ANIMATION;

        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
            attackerId: entityId,
            targetId: actionComp.targetId
        });
    }

    onAnimationCompleted(detail) {
        // アニメーション完了時にはisExecutingフラグを操作せず、
        // ActionResolutionSystemに解決処理を開始するよう通知するだけ。
        // これにより、アニメーションと結果表示〜クールダウンまでの一連のフローを保証する。
        if (this.isExecuting && this.currentExecutingActorId === detail.entityId) {
            // このイベントを ActionResolutionSystem が購読し、解決処理を開始する
        }
    }

    /**
     * UI（結果表示）の完了を待ち、次のアクション実行を許可する
     * @param {object} detail - COMBAT_RESOLUTION_DISPLAYED イベントのペイロード { attackerId }
     */
    onResolutionDisplayed(detail) {
        // 現在実行中のアクターの結果表示が完了したことを確認
        if (this.isExecuting && detail.attackerId === this.currentExecutingActorId) {
            // StateSystemへの直接参照をなくし、汎用的なイベントを発行してクールダウン移行を依頼する
            this.world.emit(GameEvents.ACTION_COMPLETED, { entityId: this.currentExecutingActorId });

            // isExecutingをfalseにすることで、updateループが次のアクションに移る
            this.isExecuting = false;
            this.currentExecutingActorId = null;
        }
    }
    
    determinePostMoveTarget(executorId) {
        const action = this.world.getComponent(executorId, Action);
        const parts = this.world.getComponent(executorId, Parts);
        const selectedPart = parts[action.partKey];

        if (selectedPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
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
}
