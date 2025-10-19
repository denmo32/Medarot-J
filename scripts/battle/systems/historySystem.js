import { BaseSystem } from '../../core/baseSystem.js';
import { PlayerInfo, BattleLog, GameState, Gauge, Parts, ActiveEffects } from '../core/components/index.js';
import { BattleHistoryContext } from '../core/index.js'; // Import new context
import { GameEvents } from '../common/events.js';
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

        // 購読イベントをEFFECTS_RESOLVEDからACTION_EXECUTEDに変更。
        // これにより、UIの確認を経て、実際に効果が適用された後に履歴を記録するようになります。
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    /**
     * 実際に効果が適用された後に呼び出され、戦闘履歴を更新します。
     * @param {object} detail - ACTION_EXECUTED イベントのペイロード
     */
    onActionExecuted(detail) {
        // ペイロードの構造をACTION_EXECUTEDに合わせる
        const { attackerId, appliedEffects } = detail;
        
        // 主なターゲット情報をダメージ効果から抽出
        const damageEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE);

        if (damageEffect) {
            const { targetId, partKey } = damageEffect;

            // 履歴ログを更新
            this.updateBattleLogs(attackerId, targetId, partKey);
            
            // プレイヤー破壊判定と状態変更ロジックは EffectApplicatorSystem に移譲されました。
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
    	// ※※※格闘の空振りは想定外の動作です※※※
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