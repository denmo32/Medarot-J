/**
 * @file BattleHistorySystem.js
 * @description 戦闘履歴を記録するシステム。
 * イベントリスナーを廃止し、CombatResultコンポーネントを監視して履歴を更新する。
 * 重要: このシステムは CombatSystem の後、BattleSequenceSystem の前に実行される必要がある。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleHistoryContext } from '../../components/BattleHistoryContext.js';
import { BattleLog, CombatResult } from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';
import { EffectType } from '../../common/constants.js';

export class BattleHistorySystem extends System {
    constructor(world) {
        super(world);
        // processedResults: 同一フレーム内で重複処理しないためのキャッシュ（必要であれば）
        // 現状は BattleSequenceSystem が CombatResult を消費するため、毎フレーム処理しても問題ないが、
        // 万が一消費されなかった場合のためにチェック機構を入れてもよい。
        // ここでは単純に存在する CombatResult を全て処理する方針とする。
    }

    update(deltaTime) {
        // CombatResult を持つエンティティ（＝戦闘解決直後のアクター）を取得
        const entities = this.getEntities(CombatResult);
        
        for (const entityId of entities) {
            const result = this.world.getComponent(entityId, CombatResult);
            if (!result || !result.data) continue;

            this._recordHistory(result.data);
        }
    }

    _recordHistory(detail) {
        const battleHistoryContext = this.world.getSingletonComponent(BattleHistoryContext);
        const { attackerId, appliedEffects, attackingPart } = detail;

        // appliedEffects が存在しない、または空の場合は履歴更新なし
        if (!appliedEffects || appliedEffects.length === 0) return;

        // メイン効果（ダメージまたは回復）を検索
        const mainEffect = appliedEffects.find(e => e.type === EffectType.DAMAGE || e.type === EffectType.HEAL);
        if (!mainEffect) return;

        const { targetId, partKey } = mainEffect;
        if (targetId === null || targetId === undefined) return;

        // 攻撃者のログ更新
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        if (attackerLog) {
            attackerLog.lastAttack = { targetId, partKey };
        }

        // 被弾者のログ更新（ダメージの場合）
        if (mainEffect.type === EffectType.DAMAGE) {
            const targetLog = this.world.getComponent(targetId, BattleLog);
            if (targetLog) {
                targetLog.lastAttackedBy = attackerId;
            }
        }

        // コンテキスト（チーム全体）の履歴更新
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);

        if (!attackerInfo || !targetInfo) return;

        if (!attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            battleHistoryContext.history.teamLastAttack[attackerInfo.teamId] = { targetId, partKey };
        }

        if (targetInfo.isLeader && !attackingPart.isSupport && mainEffect.type === EffectType.DAMAGE) {
            battleHistoryContext.history.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
    }
}