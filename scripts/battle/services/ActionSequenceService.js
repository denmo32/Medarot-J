/**
 * @file ActionSequenceService.js
 * @description アクション実行シーケンスのロジック制御。
 * キャンセル時はメッセージ表示後、強制移動はせずクールダウン状態へ遷移させる（自然な帰還を促す）。
 */
import { BattleResolutionService } from './BattleResolutionService.js';
import { TimelineBuilder } from '../tasks/TimelineBuilder.js';
import { CancellationService } from './CancellationService.js';
import { GameEvents } from '../../common/events.js';
import { GameState, Action } from '../components/index.js';
import { PlayerStateType, ModalType } from '../common/constants.js';
import { createDialogTask, createApplyStateTask } from '../tasks/BattleTasks.js'; // タスク生成用

export class ActionSequenceService {
    constructor(world) {
        this.world = world;
        this.battleResolver = new BattleResolutionService(world);
        this.timelineBuilder = new TimelineBuilder(world);
    }

    /**
     * @param {number} actorId 
     * @returns {{ tasks: Array, isCancelled: boolean, eventsToEmit: Array, stateUpdates: Array }}
     */
    executeSequence(actorId) {
        // 基本的な状態遷移（アニメーション待機）
        const stateUpdates = [{
            type: 'TRANSITION_STATE',
            targetId: actorId,
            newState: PlayerStateType.AWAITING_ANIMATION
        }];

        // 1. キャンセルチェック (事前)
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            return this._createCancelSequence(actorId, cancelCheck.reason, stateUpdates);
        }

        // 2. 戦闘結果の計算 (POST_MOVEターゲット解決もここに含まれる)
        const resultData = this.battleResolver.resolve(actorId);

        // 2.5. 解決後のキャンセルチェック (TargetingServiceなどでキャンセルされた場合)
        if (resultData.isCancelled) {
            const reason = resultData.cancelReason || 'INTERRUPTED';
            return this._createCancelSequence(actorId, reason, stateUpdates);
        }

        // 3. 演出タスクの構築
        const tasks = this.timelineBuilder.buildVisualSequence(resultData.visualSequence);

        // 状態変更コマンドを結果にマージ
        const finalStateUpdates = [...stateUpdates, ...(resultData.stateUpdates || [])];

        return { 
            tasks, 
            isCancelled: false, 
            eventsToEmit: resultData.eventsToEmit || [],
            stateUpdates: finalStateUpdates
        };
    }

    /**
     * キャンセル時のシーケンス（メッセージ -> クールダウン移行）を生成する
     */
    _createCancelSequence(actorId, reason, initialStateUpdates) {
        const tasks = [];
        const message = CancellationService.getCancelMessage(this.world, actorId, reason);
        
        // 1. メッセージ表示
        // これにより一時停止し、ユーザーの確認を待つ
        if (message) {
            tasks.push(createDialogTask(message, { modalType: ModalType.MESSAGE }));
        }

        // 2. クールダウン状態へ移行 (タスクとして実行)
        // メッセージを閉じた直後に実行される。
        // ここでCHARGING状態・ゲージ0になることで、MovementSystemにより自然にホームへの帰還が始まる。
        tasks.push(createApplyStateTask([{
            type: 'RESET_TO_COOLDOWN',
            targetId: actorId,
            options: { interrupted: true }
        }]));

        // ACTION_CANCELLED イベントは発行リストに含める
        const eventsToEmit = [{
            type: GameEvents.ACTION_CANCELLED,
            payload: { entityId: actorId, reason: reason }
        }];

        return { 
            tasks, 
            isCancelled: true, 
            eventsToEmit, 
            stateUpdates: initialStateUpdates // AWAITING_ANIMATION への遷移のみ即時実行
        };
    }
    
    getSortedReadyEntities() {
        return this.world.getEntitiesWith(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        }).sort((a, b) => {
            // 循環参照回避のため QueryService のロジックをインライン化または別で持つべきだが
            // ここでは簡易的に実装
            const partsA = this.world.getComponent(a, 'Parts');
            const partsB = this.world.getComponent(b, 'Parts');
            const propA = partsA?.legs?.propulsion || 0;
            const propB = partsB?.legs?.propulsion || 0;
            return propB - propA;
        });
    }
}