/**
 * @file ActionSequenceService.js
 * @description アクション実行シーケンスのロジック制御。
 * 結果データに含まれる stateUpdates も返却するように変更。
 */
import { BattleResolutionService } from './BattleResolutionService.js';
import { TimelineBuilder } from '../tasks/TimelineBuilder.js';
import { CancellationService } from './CancellationService.js';
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
        // 副作用をコマンドとして定義
        const stateUpdates = [{
            type: 'TRANSITION_STATE',
            targetId: actorId,
            newState: PlayerStateType.AWAITING_ANIMATION
        }];

        // 1. キャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            CancellationService.executeCancel(this.world, actorId, cancelCheck.reason);
            stateUpdates.push({
                type: 'RESET_TO_COOLDOWN',
                targetId: actorId,
                options: { interrupted: true }
            });
            return { tasks: [], isCancelled: true, eventsToEmit: [], stateUpdates };
        }

        // 2. 戦闘結果の計算 (POST_MOVEターゲット解決もここに含まれる)
        const resultData = this.battleResolver.resolve(actorId);

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