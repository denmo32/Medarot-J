// scripts/systems/historySystem.js:

import { BaseSystem } from '../../core/baseSystem.js';
// ★変更: 必要なコンポーネントと定数をインポート
import { PlayerInfo, BattleLog, GameState, Gauge, Parts, ActiveEffects } from '../core/components.js';
import { BattleHistoryContext } from '../core/index.js'; // Import new context
import { GameEvents } from '../common/events.js';
// ★変更: EffectType, PartInfo をインポート
import { PlayerStateType, TeamID, EffectType, PartInfo } from '../common/constants.js';


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
        // ★変更: 新しいペイロード構造に対応
        const { attackerId, resolvedEffects, guardianInfo } = detail;

        // ★新規: ガードが発動した場合、ガード回数を減らす
        if (guardianInfo) {
            const guardianEffects = this.world.getComponent(guardianInfo.id, ActiveEffects);
            if (guardianEffects) {
                const guardEffect = guardianEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
                if (guardEffect) {
                    // ガード回数を1減らす。効果の削除と状態遷移はStateSystemが担当する。
                    guardEffect.count--;
                }
            }
        }
        
        // 主なターゲット情報をダメージ効果から抽出
        const damageEffect = resolvedEffects.find(e => e.type === EffectType.DAMAGE);

        if (damageEffect) {
            const { targetId, partKey } = damageEffect;

            // 履歴ログを更新
            this.updateBattleLogs(attackerId, targetId, partKey);
            
            // プレイヤー自体が機能停止（頭部破壊）した場合の処理
            const targetParts = this.world.getComponent(targetId, Parts);
            const isPlayerBroken = partKey === PartInfo.HEAD.key && targetParts[partKey].hp === 0;

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