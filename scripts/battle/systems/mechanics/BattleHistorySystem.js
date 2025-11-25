/**
 * @file 戦闘履歴管理システム
 * @description 戦闘結果イベントを監視し、BattleLogコンポーネントやBattleContextの履歴データを更新します。
 * ActionResolutionSystemから履歴管理の責務を分離し、単一責任の原則を遵守します。
 */
import { BaseSystem } from '../../../engine/baseSystem.js';
import { BattleContext } from '../../context/index.js';
import { BattleLog, PlayerInfo } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { EffectType } from '../../common/constants.js';

export class BattleHistorySystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        // 戦闘シーケンス解決イベントを購読
        this.world.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
    }

    /**
     * 戦闘結果に基づいて履歴を更新します。
     * @param {object} detail - COMBAT_SEQUENCE_RESOLVED イベントのペイロード
     */
    onCombatSequenceResolved(detail) {
        const { attackerId, appliedEffects, attackingPart } = detail;
        
        // 履歴更新の対象となる主要な効果を探す (ダメージまたは回復)
        const mainEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE || e.type === EffectType.HEAL);
        if (!mainEffect) return;

        const { targetId, partKey } = mainEffect;
        if (targetId === null || targetId === undefined) return;

        // --- 1. 個人履歴 (BattleLog) の更新 ---
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        if (attackerLog) {
            // FOCUS性格などのために、行動対象は常に記録する
            attackerLog.lastAttack = { targetId, partKey };
        }

        // ダメージを与えた場合のみ、被攻撃履歴を更新
        if (mainEffect.type === EffectType.DAMAGE) {
            const targetLog = this.world.getComponent(targetId, BattleLog);
            if (targetLog) {
                targetLog.lastAttackedBy = attackerId;
            }
        }

        // --- 2. チーム履歴 (BattleContext) の更新 ---
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);

        if (!attackerInfo || !targetInfo) return;

        // 攻撃アクションの場合のみ teamLastAttack を更新する
        // これにより、回復行動がASSIST性格のターゲット選択に影響を与えるのを防ぐ
        if (!attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            this.battleContext.history.teamLastAttack[attackerInfo.teamId] = { targetId, partKey };
        }

        // 敵リーダーにダメージを与えた場合のみ leaderLastAttackedBy を更新する
        if (targetInfo.isLeader && !attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            this.battleContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }
}