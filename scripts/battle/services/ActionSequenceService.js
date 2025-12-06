/**
 * @file ActionSequenceService.js
 * @description アクション実行シーケンスのロジック制御を担当するサービス。
 * Systemからロジックを分離し、計算・解決・タスク生成の一連の流れを管理する。
 */
import { BattleResolver } from '../logic/BattleResolver.js';
import { TimelineBuilder } from '../tasks/TimelineBuilder.js';
import { EffectApplier } from '../logic/EffectApplier.js';
import { CooldownService } from './CooldownService.js';
import { CancellationService } from './CancellationService.js';
import { PlayerStatusService } from './PlayerStatusService.js';
import { TargetingService } from './TargetingService.js';
import { GameEvents } from '../../common/events.js';
import { GameState, Action } from '../components/index.js';
import { PlayerStateType } from '../common/constants.js';
import { compareByPropulsion } from '../utils/queryUtils.js';

export class ActionSequenceService {
    constructor(world) {
        this.world = world;
        this.battleResolver = new BattleResolver(world);
        this.timelineBuilder = new TimelineBuilder(world);
    }

    /**
     * 実行待ち状態のエンティティ一覧を取得し、行動順（推進が高い順）にソートして返す
     * @returns {number[]} entityIdの配列
     */
    getSortedReadyEntities() {
        const readyEntities = this.world.getEntitiesWith(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        readyEntities.sort(compareByPropulsion(this.world));
        return readyEntities;
    }

    /**
     * 指定されたアクターのアクションシーケンスを実行（計算・適用・演出生成）する
     * @param {number} actorId 
     * @returns {{ tasks: Array, isCancelled: boolean }}
     */
    executeSequence(actorId) {
        // 状態遷移: アニメーション待機へ
        PlayerStatusService.transitionTo(this.world, actorId, PlayerStateType.AWAITING_ANIMATION);

        // 1. 実行直前のキャンセルチェック
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            CancellationService.executeCancel(this.world, actorId, cancelCheck.reason);
            CooldownService.resetEntityStateToCooldown(this.world, actorId, { interrupted: true });
            return { tasks: [], isCancelled: true };
        }

        const actionComp = this.world.getComponent(actorId, Action);

        // 2. 移動後ターゲット決定 (TargetingServiceに委譲)
        TargetingService.resolvePostMoveTarget(this.world, actorId, actionComp);

        // 3. 戦闘結果の計算 (Logic)
        const resultData = this.battleResolver.resolve(actorId);

        // 4. Logicデータの即時更新 (副作用の適用)
        EffectApplier.applyResult(this.world, resultData);
        
        // 外部への通知
        this.world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, resultData);

        // 5. 演出タスクの構築
        const tasks = this.timelineBuilder.buildAttackSequence(resultData);

        return { tasks, isCancelled: false };
    }
}