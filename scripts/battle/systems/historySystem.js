// scripts/systems/historySystem.js:

import { BaseSystem } from '../../core/baseSystem.js';
// ★変更: 必要なコンポーネントと定数をインポート
import { PlayerInfo, BattleLog, GameContext, GameState, Gauge } from '../core/components.js';
import { BattleHistoryContext } from '../core/index.js'; // Import new context
import { GameEvents } from '../common/events.js';
import { PlayerStateType, TeamID } from '../common/constants.js'; // Import TeamID for context


/**
 * 戦闘結果に基づき、戦闘履歴（BattleLog, BattleHistoryContext）を更新するシステム。
 * StateSystemから責務を分離するために新設されました。
 * Note: After context separation, this system now updates BattleHistoryContext
 * instead of the old GameContext for teamLastAttack and leaderLastAttackedBy.
 */
export class HistorySystem extends BaseSystem {
    constructor(world) {
        super(world);
        // Use new BattleHistoryContext for battle history data
        this.battleHistoryContext = this.world.getSingletonComponent(BattleHistoryContext);

        // 行動が実行されたイベントをリッスンし、履歴を更新する
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    /**
     * ★新規: プレイヤー破壊処理を責務として追加
     * 戦闘の最も重要な結果であるプレイヤー破壊をこのシステムで処理することで、
     * StateSystemを状態遷移に集中させ、責務を明確にします。
     * @param {object} detail - ACTION_EXECUTEDイベントのペイロード
     */
    onActionExecuted(detail) {
        const { attackerId, targetId, targetPartKey, isPlayerBroken } = detail;

        // 履歴ログを更新
        this.updateBattleLogs(attackerId, targetId, targetPartKey);

        // プレイヤー自体が機能停止（頭部破壊）した場合の処理
        if (isPlayerBroken) {
            const gameState = this.world.getComponent(targetId, GameState);
            const gauge = this.world.getComponent(targetId, Gauge);
            
            // 状態を「破壊」に即時変更し、以降の行動をすべて不能にします。
            if (gameState) gameState.state = PlayerStateType.BROKEN;
            if (gauge) gauge.value = 0; 
            
            // GameFlowSystemにプレイヤー破壊を通知し、ゲームオーバー判定を促します。
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId });
        }
    }

    /**
     * 攻撃の実行結果に基づき、戦闘履歴を更新します。
     * 元々はStateSystemにあったメソッドです。
     * @param {number} attackerId - 攻撃者のエンティティID
     * @param {number} targetId - ターゲットのエンティティID
     * @param {string} targetPartKey - ターゲットのパーツキー
     */
    updateBattleLogs(attackerId, targetId, targetPartKey) {
        // ターゲットがいない場合（格闘の空振りなど）は何もしない
        if (!targetId) return;

        // 攻撃者とターゲットの情報を取得
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);
        const targetLog = this.world.getComponent(targetId, BattleLog);

        if (!attackerInfo || !attackerLog || !targetInfo || !targetLog) return;

        // 攻撃者のログを更新 (Focus性格用)
        attackerLog.lastAttack.targetId = targetId;
        attackerLog.lastAttack.partKey = targetPartKey;

        // ターゲットのログを更新 (Counter性格用)
        targetLog.lastAttackedBy = attackerId;

        // チームの最終攻撃情報を更新 (Assist性格用)
        this.battleHistoryContext.teamLastAttack[attackerInfo.teamId] = {
            targetId: targetId,
            partKey: targetPartKey
        };

        // ターゲットがリーダーの場合、リーダーへの最終攻撃情報を更新 (Guard性格用)
        if (targetInfo.isLeader) {
            this.battleHistoryContext.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }

    update(deltaTime) {
        // このシステムはイベント駆動なので、updateループでの処理は不要
    }
}