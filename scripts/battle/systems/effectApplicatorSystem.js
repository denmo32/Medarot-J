/**
 * @file 効果適用システム (新規作成)
 * このファイルは、ActionSystemによって「解決（計算）」された効果を、
 * 実際にエンティティのコンポーネントに「適用（反映）」する責務を持ちます。
 * これにより、効果の計算ロジックと状態変更ロジックを明確に分離します。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Parts, ActiveEffects, PlayerInfo } from '../core/components/index.js';
import { EffectType, PartInfo } from '../common/constants.js';

/**
 * ActionSystemが発行するEFFECTS_RESOLVEDイベントを購読し、
 * ダメージ、回復、状態異常などの効果をワールドの状態に反映させるシステム。
 */
export class EffectApplicatorSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // ActionSystemによって効果の計算が完了したことを示すイベントを購読します。
        this.world.on(GameEvents.EFFECTS_RESOLVED, this.onEffectsResolved.bind(this));
    }

    /**
     * 計算済みの効果を受け取り、ワールドの状態を更新します。
     * @param {object} detail - EFFECTS_RESOLVEDイベントのペイロード
     */
    onEffectsResolved(detail) {
        const { resolvedEffects, guardianInfo } = detail;

        // 効果がない場合は何もしません。
        if (!resolvedEffects || resolvedEffects.length === 0) {
            return;
        }

        // --- 1. ガード効果の処理 ---
        // ガードが発動した場合、まずガード役のガード回数を減らします。
        if (guardianInfo) {
            const guardianEffects = this.world.getComponent(guardianInfo.id, ActiveEffects);
            if (guardianEffects) {
                const guardEffect = guardianEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
                if (guardEffect) {
                    // ガード回数を1減らします。効果の削除と状態遷移はStateSystemが担当します。
                    guardEffect.count--;
                }
            }
        }

        // --- 2. 各効果の適用 ---
        for (const effect of resolvedEffects) {
            switch (effect.type) {
                case EffectType.DAMAGE:
                    this.applyDamage(effect);
                    break;
                case EffectType.HEAL:
                    this.applyHeal(effect);
                    break;
                // 他のタイプの効果もここに追加していきます
                // 例: APPLY_SCAN, APPLY_GUARDなど、ActiveEffectsコンポーネントを変更する効果
            }
        }
    }

    /**
     * ダメージ効果を適用します。
     * @param {object} effect - ダメージ効果オブジェクト
     * @private
     */
    applyDamage(effect) {
        const { targetId, partKey, value: damage } = effect;
        if (targetId === null || targetId === undefined) return;

        const targetParts = this.world.getComponent(targetId, Parts);
        if (!targetParts || !targetParts[partKey]) return;

        const part = targetParts[partKey];
        const oldHp = part.hp;
        part.hp = Math.max(0, part.hp - damage);

        // パーツが破壊されたか判定し、イベントを発行します。
        const isPartBroken = oldHp > 0 && part.hp === 0;
        if (isPartBroken) {
            part.isBroken = true;
            this.world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey: partKey });

            // --- ▼▼▼ ここからがステップ3の変更箇所 ▼▼▼ ---
            // ★修正: 頭部破壊時に、GameFlowSystemが必要とするチームIDもペイロードに含める
            if (partKey === PartInfo.HEAD.key) {
                const playerInfo = this.world.getComponent(targetId, PlayerInfo);
                if (playerInfo) {
                    this.world.emit(GameEvents.PLAYER_BROKEN, { 
                        entityId: targetId,
                        teamId: playerInfo.teamId // チームIDを追加
                    });
                }
            }
            // --- ▲▲▲ ステップ3の変更箇所ここまで ▲▲▲ ---
        }
    }

    /**
     * 回復効果を適用します。
     * @param {object} effect - 回復効果オブジェクト
     * @private
     */
    applyHeal(effect) {
        const { targetId, partKey, value: healAmount } = effect;
        if (targetId === null || targetId === undefined) return;

        const targetParts = this.world.getComponent(targetId, Parts);
        if (!targetParts || !targetParts[partKey]) return;

        const part = targetParts[partKey];
        // 回復は破壊されていないパーツにのみ有効です。
        if (!part.isBroken) {
            part.hp = Math.min(part.maxHp, part.hp + healAmount);
        }
    }

    // このシステムはイベント駆動で動作するため、update処理は不要です。
    update(deltaTime) {}
}