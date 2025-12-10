/**
 * @file ActionSequenceService.js
 * @description アクション実行シーケンスのロジック制御。
 * 結果データに含まれる stateUpdates も返却するように変更。
 */
import { BattleResolutionService } from './BattleResolutionService.js';
import { TimelineBuilder } from '../tasks/TimelineBuilder.js';
import { CooldownService } from './CooldownService.js';
import { CancellationService } from './CancellationService.js';
import { PlayerStatusService } from './PlayerStatusService.js';
import { TargetingService } from './TargetingService.js';
import { GameEvents } from '../../common/events.js';
import { GameState, Action } from '../components/index.js';
import { PlayerStateType } from '../common/constants.js';

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
        // 状態遷移: アニメーション待機へ (これは演出シーケンス前の即時反映が必要なためここで実行)
        PlayerStatusService.transitionTo(this.world, actorId, PlayerStateType.AWAITING_ANIMATION);

        // 1. キャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            CancellationService.executeCancel(this.world, actorId, cancelCheck.reason);
            CooldownService.resetEntityStateToCooldown(this.world, actorId, { interrupted: true });
            return { tasks: [], isCancelled: true, eventsToEmit: [], stateUpdates: [] };
        }

        const actionComp = this.world.getComponent(actorId, Action);

        // 2. 移動後ターゲット決定
        TargetingService.resolvePostMoveTarget(this.world, actorId, actionComp);

        // 3. 戦闘結果の計算 (純粋計算、副作用指示書を含む)
        const resultData = this.battleResolver.resolve(actorId);

        // 4. 演出タスクの構築
        const tasks = this.timelineBuilder.buildAttackSequence(resultData);

        return { 
            tasks, 
            isCancelled: false, 
            eventsToEmit: resultData.eventsToEmit || [],
            stateUpdates: resultData.stateUpdates || []
        };
    }
    
    // getSortedReadyEntities は変更なし
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