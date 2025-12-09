/**
 * @file ActionSequenceService.js
 * @description アクション実行シーケンスのロジック制御。
 * 戻り値としてイベントリストを返し、System側でemitする。
 */
import { BattleResolutionService } from './BattleResolutionService.js';
import { TimelineBuilder } from '../tasks/TimelineBuilder.js';
// EffectApplyServiceは不要になる（BattleResolutionServiceが適用済み、イベントは戻り値に含まれる）
import { CooldownService } from './CooldownService.js';
import { CancellationService } from './CancellationService.js';
import { PlayerStatusService } from './PlayerStatusService.js';
import { TargetingService } from './TargetingService.js';
import { QueryService } from './QueryService.js';
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
     * @returns {number[]}
     */
    getSortedReadyEntities() {
        const readyEntities = this.world.getEntitiesWith(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        readyEntities.sort(QueryService.compareByPropulsion(this.world));
        return readyEntities;
    }

    /**
     * @param {number} actorId 
     * @returns {{ tasks: Array, isCancelled: boolean, eventsToEmit: Array }}
     */
    executeSequence(actorId) {
        // 状態遷移: アニメーション待機へ
        PlayerStatusService.transitionTo(this.world, actorId, PlayerStateType.AWAITING_ANIMATION);

        // 1. キャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            CancellationService.executeCancel(this.world, actorId, cancelCheck.reason);
            CooldownService.resetEntityStateToCooldown(this.world, actorId, { interrupted: true });
            return { tasks: [], isCancelled: true, eventsToEmit: [] };
        }

        const actionComp = this.world.getComponent(actorId, Action);

        // 2. 移動後ターゲット決定
        TargetingService.resolvePostMoveTarget(this.world, actorId, actionComp);

        // 3. 戦闘結果の計算 (副作用なし、イベントリスト含む)
        const resultData = this.battleResolver.resolve(actorId);

        // 4. 演出タスクの構築
        const tasks = this.timelineBuilder.buildAttackSequence(resultData);

        return { 
            tasks, 
            isCancelled: false, 
            eventsToEmit: resultData.eventsToEmit || [] 
        };
    }
}