import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../context/index.js';
import { Action, GameState } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { BattlePhase, PlayerStateType } from '../../common/constants.js';
import { TargetTiming } from '../../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';

export class ActionExecutionSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.executionQueue = [];
        this.isProcessingQueue = false;

        this.on(GameEvents.ACTION_SEQUENCE_COMPLETED, this.onActionSequenceCompleted.bind(this));
        this.on(GameEvents.REQUEST_EXECUTION_ANIMATION, this.onRequestExecutionAnimation.bind(this));
    }

    update(deltaTime) {
        // フェーズ監視とキューの充填のみを行う
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            this.executionQueue = [];
            this.isProcessingQueue = false;
            return;
        }

        // キューが空で、かつ処理中でなければ、実行可能なエンティティを探してキューに積む
        if (this.executionQueue.length === 0 && !this.isProcessingQueue) {
            this.populateExecutionQueueFromReady();
            
            // それでも空ならフェーズ終了
            if (this.executionQueue.length === 0) {
                this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
                return;
            }
        }

        // キューがあり、処理中でなければ、次のアクションのシーケンス開始を要求する
        if (!this.isProcessingQueue && this.executionQueue.length > 0) {
            this._startNextActionSequence();
        }
    }
    
    populateExecutionQueueFromReady() {
        const readyEntities = this.getEntities(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        readyEntities.sort(compareByPropulsion(this.world));
        
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

    _startNextActionSequence() {
        const actionDetail = this.executionQueue.shift();
        if (!actionDetail) return;

        this.isProcessingQueue = true;
        const { entityId } = actionDetail;
        
        // コンポーネントにアクション情報をセット
        const actionComp = this.world.getComponent(entityId, Action);
        Object.assign(actionComp, actionDetail);

        this.determinePostMoveTarget(entityId);

        // 状態更新
        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState) gameState.state = PlayerStateType.AWAITING_ANIMATION;

        // シーケンス開始をBattleSequenceSystemに依頼
        this.world.emit(GameEvents.REQUEST_ACTION_SEQUENCE_START, { 
            entityId, 
            actionDetail 
        });
    }

    /**
     * BattleSequenceSystemからのアニメーション実行要求
     */
    onRequestExecutionAnimation(detail) {
        const { entityId } = detail;
        const action = this.world.getComponent(entityId, Action);

        // ViewSystemへアニメーション実行を依頼
        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
            attackerId: entityId,
            targetId: action.targetId
        });
        
        // ViewSystemが完了後に EXECUTION_ANIMATION_COMPLETED を発行し、
        // それをBattleSequenceSystemが拾う
    }

    /**
     * BattleSequenceSystemからのシーケンス完了通知
     */
    onActionSequenceCompleted(detail) {
        // 次のキュー処理へ
        this.isProcessingQueue = false;
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