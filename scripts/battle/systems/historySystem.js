
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

        // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
        // ★修正: 行動が実行された時ではなく、効果が「解決」された時点で履歴を更新するように変更。
        // これにより、UIの進行を待たずに、戦闘の論理的な結果を即座に記録できます。
        this.world.on(GameEvents.EFFECTS_RESOLVED, this.onEffectsResolved.bind(this));
        // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---
    }

    /**
     * ★新規: プレイヤー破壊処理を責務として追加
     * 戦闘の最も重要な結果であるプレイヤー破壊をこのシステムで処理することで、
     * StateSystemを状態遷移に集中させ、責務を明確にします。
     * @param {object} detail - EFFECTS_RESOLVED イベントのペイロード
     */
    onEffectsResolved(detail) {
        // ★変更: 新しいペイロード構造に対応
        const { attackerId, resolvedEffects } = detail;
        
        // ★削除: ガード回数を減らす処理は EffectApplicatorSystem に移譲されました。
        
        // 主なターゲット情報をダメージ効果から抽出
        const damageEffect = resolvedEffects.find(e => e.type === EffectType.DAMAGE);

        if (damageEffect) {
            const { targetId, partKey } = damageEffect;

            // 履歴ログを更新
            this.updateBattleLogs(attackerId, targetId, partKey);
            
            // ★削除: プレイヤー破壊判定と状態変更ロジックは EffectApplicatorSystem に移譲されました。
            // これにより、このシステムは「履歴の更新」という単一の責務に集中します。
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