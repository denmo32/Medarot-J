import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { BattlePhase, PlayerStateType, ModalType, ActionCancelReason } from '../../common/constants.js';
import { TargetTiming } from '../../../common/constants.js';
import { BattleContext } from '../../context/index.js';
import { GameState, Action } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';
import { BattleResolver } from '../../logic/BattleResolver.js';

const SequenceState = {
    IDLE: 'IDLE',
    PROCESSING: 'PROCESSING', // キュー処理中
    ANIMATING: 'ANIMATING',
    DISPLAYING: 'DISPLAYING',
    COOLDOWN: 'COOLDOWN'
};

/**
 * @class BattleSequenceSystem
 * @description アクション実行フェーズの統合管理システム。
 * キューの管理、アニメーション、計算、結果表示、クールダウン移行を一元的に制御します。
 */
export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.battleResolver = new BattleResolver(world);
        
        this.executionQueue = [];
        this.currentState = SequenceState.IDLE;
        this.currentActorId = null;
        this.currentResultData = null;

        // イベントバインディング
        this.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onAnimationCompleted.bind(this));
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));
        this.on(GameEvents.COOLDOWN_TRANSITION_COMPLETED, this.onCooldownCompleted.bind(this));
    }

    update(deltaTime) {
        // フェーズ監視
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            this._resetQueue();
            return;
        }

        // アイドル状態ならキューを補充または次の処理を開始
        if (this.currentState === SequenceState.IDLE) {
            if (this.executionQueue.length === 0) {
                this._populateExecutionQueueFromReady();
                
                // それでも空ならフェーズ終了
                if (this.executionQueue.length === 0) {
                    this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
                    return;
                }
            }
            
            // 次のアクションを開始
            this._startNextActionSequence();
        }
    }
    
    _resetQueue() {
        this.executionQueue = [];
        this.currentState = SequenceState.IDLE;
        this.currentActorId = null;
        this.currentResultData = null;
    }

    _populateExecutionQueueFromReady() {
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

        this.currentActorId = actionDetail.entityId;
        this.currentState = SequenceState.PROCESSING;
        
        // アクション情報の更新
        const actionComp = this.world.getComponent(this.currentActorId, Action);
        Object.assign(actionComp, actionDetail);

        // 移動後ターゲットの決定 (必要なら)
        this._determinePostMoveTarget(this.currentActorId);

        // 状態更新
        const gameState = this.world.getComponent(this.currentActorId, GameState);
        if (gameState) gameState.state = PlayerStateType.AWAITING_ANIMATION;

        // --- ステップ1: アニメーション開始 ---
        this.currentState = SequenceState.ANIMATING;
        
        // ViewSystemへアニメーション実行を依頼
        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
            attackerId: this.currentActorId,
            targetId: actionComp.targetId
        });
    }

    _determinePostMoveTarget(executorId) {
        const action = this.world.getComponent(executorId, Action);
        const parts = this.world.getComponent(executorId, Parts);
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

    /**
     * ステップ2: アニメーション完了 -> 計算 -> 結果表示
     */
    onAnimationCompleted(detail) {
        if (this.currentState !== SequenceState.ANIMATING || detail.entityId !== this.currentActorId) {
            return;
        }

        // --- ステップ2.1: 計算実行 ---
        this.currentResultData = this.battleResolver.resolve(this.currentActorId);

        if (this.currentResultData.isCancelled) {
            // キャンセルされた場合
            this.world.emit(GameEvents.ACTION_CANCELLED, { 
                entityId: this.currentActorId, 
                reason: this.currentResultData.cancelReason || ActionCancelReason.INTERRUPTED 
            });
            
            // キャンセル時は即座にクールダウンへ
            this._proceedToCooldown();
            return;
        }

        // --- ステップ3: 結果表示 ---
        this.currentState = SequenceState.DISPLAYING;
        
        // MessageSystemへ結果表示を依頼
        this.world.emit(GameEvents.REQUEST_RESULT_DISPLAY, { resultData: this.currentResultData });
    }

    /**
     * ステップ4: 結果表示完了 (モーダル閉鎖) -> クールダウン
     */
    onModalClosed(detail) {
        if (this.currentState !== SequenceState.DISPLAYING) return;

        // 攻撃宣言(ATTACK_DECLARATION)または結果(EXECUTION_RESULT)が閉じられたら次へ
        // ActionPanelSystemのキューイングにより、最後のモーダルが閉じられた時にここに来る想定
        const targetModalTypes = [ModalType.EXECUTION_RESULT, ModalType.ATTACK_DECLARATION];
        
        if (targetModalTypes.includes(detail.modalType)) {
            this._proceedToCooldown();
        }
    }

    _proceedToCooldown() {
        this.currentState = SequenceState.COOLDOWN;
        // CooldownSystemへ移行依頼
        this.world.emit(GameEvents.REQUEST_COOLDOWN_TRANSITION, { entityId: this.currentActorId });
    }

    /**
     * ステップ5: クールダウン完了 -> シーケンス終了
     */
    onCooldownCompleted(detail) {
        if (this.currentState !== SequenceState.COOLDOWN || detail.entityId !== this.currentActorId) {
            return;
        }

        const actorId = this.currentActorId;
        
        // 状態リセット
        this.currentState = SequenceState.IDLE;
        this.currentActorId = null;
        this.currentResultData = null;
        
        // このアクションシーケンスの完了を通知（必要であれば）
        this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: actorId });
        
        // updateループにより、自動的に次のキューアイテムが処理される
    }
}