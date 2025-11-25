/**
 * @file ActionSetupSystem.js
 * @description [改善案] 行動選択後のセットアップ処理を専門に担当するシステム。
 * StateSystemから責務を分割し、単一責任の原則を強化します。
 */
import { BaseSystem } from '../../../engine/baseSystem.js';
import { GameEvents } from '../../../common/events.js';
import { Action, GameState, Gauge, Parts } from '../../components/index.js';
import { PlayerStateType } from '../../common/constants.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';

export class ActionSetupSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // プレイヤーまたはAIによって行動が選択されたイベントのみを購読します。
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
    }

    /**
     * 行動選択後のセットアップ処理を行います。
     * - Actionコンポーネントに選択されたパーツ情報を設定
     * - 状態を 'SELECTED_CHARGING' に遷移
     * - ゲージをリセットし、チャージ用の速度補正を計算・適用
     * @param {object} detail - ACTION_SELECTED イベントのペイロード
     */
    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        // パーツが無効な場合は、再選択を要求して処理を中断します。
        if (!partKey || !parts?.[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionSetupSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const selectedPart = parts[partKey];

        // Actionコンポーネントを更新
        action.partKey = partKey;
        action.type = selectedPart.action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        action.targetTiming = selectedPart.targetTiming;

        // 状態を「行動選択済みチャージ中」へ遷移
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // ゲージをリセットし、チャージ時間用の速度補正を適用
        gauge.value = 0;
        gauge.currentSpeed = 0;
        gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: selectedPart, factorType: 'charge' });
    }
}