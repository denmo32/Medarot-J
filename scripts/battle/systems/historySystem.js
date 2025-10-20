import { BaseSystem } from '../../core/baseSystem.js';
import { PlayerInfo, BattleLog, GameState, Gauge, Parts, ActiveEffects } from '../core/components/index.js';
// [リファクタリング] 古いコンテキストを新しいBattleContextに置き換えます。
import { BattleContext } from '../core/index.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType, TeamID, EffectType, PartInfo } from '../common/constants.js';


/**
 * 戦闘結果に基づき、戦闘履歴（BattleLog, BattleHistoryContext）を更新するシステム。
 * StateSystemから責務を分離するために新設されました。
 */
export class HistorySystem extends BaseSystem {
    constructor(world) {
        super(world);
        // [リファクタリング] BattleContextへの参照を保持します。
        this.battleContext = this.world.getSingletonComponent(BattleContext);

        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    /**
     * 実際に効果が適用された後に呼び出され、戦闘履歴を更新します。
     * @param {object} detail - ACTION_EXECUTED イベントのペイロード
     */
    onActionExecuted(detail) {
        const { attackerId, appliedEffects } = detail;
        
        const damageEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE);

        if (damageEffect) {
            const { targetId, partKey } = damageEffect;
            this.updateBattleLogs(attackerId, targetId, partKey);
        }
    }


    /**
     * 攻撃の実行結果に基づき、戦闘履歴を更新します。
     * @param {number} attackerId - 攻撃者のエンティティID
     * @param {number} targetId - ターゲットのエンティティID
     * @param {string} targetPartKey - ターゲットのパーツキー
     */
    updateBattleLogs(attackerId, targetId, targetPartKey) {
    	if (!targetId) return;

        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);
        const targetLog = this.world.getComponent(targetId, BattleLog);

        if (!attackerInfo || !attackerLog || !targetInfo || !targetLog) return;

        attackerLog.lastAttack.targetId = targetId;
        attackerLog.lastAttack.partKey = targetPartKey;
        targetLog.lastAttackedBy = attackerId;

        // [リファクタリング] BattleContextのhistoryを更新します。
        this.battleContext.history.teamLastAttack[attackerInfo.teamId] = {
            targetId: targetId,
            partKey: targetPartKey
        };

        if (targetInfo.isLeader) {
            this.battleContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }

    update(deltaTime) {
    }
}