// scripts/systems/historySystem.js:

import { PlayerInfo, BattleLog, GameContext } from '../core/components.js';
import { GameEvents } from '../common/events.js';

/**
 * 戦闘結果に基づき、戦闘履歴（BattleLog, GameContext）を更新するシステム。
 * StateSystemから責務を分離するために新設されました。
 */
export class HistorySystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(GameContext);

        // 行動が実行されたイベントをリッスンし、履歴を更新する
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    onActionExecuted(detail) {
        const { attackerId, targetId, targetPartKey } = detail;
        this.updateBattleLogs(attackerId, targetId, targetPartKey);
    }

    /**
     * 攻撃の実行結果に基づき、戦闘履歴を更新します。
     * 元々はStateSystemにあったメソッドです。
     * @param {number} attackerId - 攻撃者のエンティティID
     * @param {number} targetId - ターゲットのエンティティID
     * @param {string} targetPartKey - ターゲットのパーツキー
     */
    updateBattleLogs(attackerId, targetId, targetPartKey) {
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
        this.context.teamLastAttack[attackerInfo.teamId] = {
            targetId: targetId,
            partKey: targetPartKey
        };

        // ターゲットがリーダーの場合、リーダーへの最終攻撃情報を更新 (Guard性格用)
        if (targetInfo.isLeader) {
            this.context.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }

    update(deltaTime) {
        // このシステムはイベント駆動なので、updateループでの処理は不要
    }
}
