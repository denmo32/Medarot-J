/**
 * @file StunHandler.js
 * @description スタン付与 (APPLY_STUN) のロジック。
 * 被弾ダメージの適用と、ゲージ停止状態の付与を行う。
 */
import { EffectHandler } from './EffectHandler.js';
import { ApplyEffect, EffectContext } from '../../components/effects/Effects.js';
import { Parts } from '../../../components/index.js'; 
import { ActiveEffects, IsStunned } from '../../components/index.js'; 
import { PartStatus } from '../../components/parts/PartComponents.js';
import { EffectType } from '../../common/constants.js';
import { HpChangedEvent } from '../../../components/Events.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { buildDamageParams } from '../../logic/CombatParameterBuilder.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';

export class StunHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { sourceId, targetId, partKey, outcome, attackingPart } = context;

        // 1. ダメージ計算
        const params = buildDamageParams(world, {
            sourceId,
            targetId,
            attackingPart,
            outcome
        });
        
        const baseDamage = CombatCalculator.calculateDamage(params);
        // 要件: 最終ダメージを2で割る
        const finalDamage = Math.floor(baseDamage / 2);

        const targetPartsComponent = world.getComponent(targetId, Parts);
        if (!targetPartsComponent || targetPartsComponent[partKey] === null) {
            this.finish(world, effectEntityId, { value: 0 });
            return;
        }

        const partEntityId = targetPartsComponent[partKey];
        const partStatus = world.getComponent(partEntityId, PartStatus);

        if (!partStatus) {
            this.finish(world, effectEntityId, { value: 0 });
            return;
        }

        // 2. ダメージ適用
        const oldHp = partStatus.hp;
        const newHp = Math.max(0, oldHp - finalDamage);
        const actualDamage = oldHp - newHp;
        partStatus.hp = newHp;

        // 3. スタン付与 (ダメージが1以上の場合)
        let wasStunned = false;
        // ダメージ比例の持続時間: 1ダメージにつき250ms (例: 10ダメージで2.5秒)
        const durationPerDamage = 250; 
        const stunDuration = actualDamage * durationPerDamage;

        if (actualDamage > 0 && stunDuration > 0) {
            wasStunned = true;
            // タグ付与
            if (!world.getComponent(targetId, IsStunned)) {
                world.addComponent(targetId, new IsStunned());
            }

            // エフェクトリストに追加（時間管理用）
            const activeEffects = world.getComponent(targetId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_STUN);
                activeEffects.effects.push({
                    type: EffectType.APPLY_STUN,
                    value: actualDamage,
                    duration: stunDuration,
                    tickInterval: 100, // 0.1秒ごとに監視
                    elapsedTime: 0,
                    partKey: partKey
                });
            }
        }

        const hpChangeEventEntity = world.createEntity();
        world.addComponent(hpChangeEventEntity, new HpChangedEvent({
            entityId: targetId,
            partKey,
            newHp,
            oldHp,
            maxHp: partStatus.maxHp,
            change: -actualDamage,
            isHeal: false
        }));

        const resultData = {
            type: EffectType.APPLY_STUN,
            targetId,
            partKey,
            value: actualDamage,
            duration: (stunDuration / 1000).toFixed(1), // 秒数表示
            isCritical: outcome.isCritical,
            wasStunned
        };

        this.finish(world, effectEntityId, resultData);
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.APPLY_STUN];
        return { messageKey: resultData.wasStunned ? def.keys.success : def.keys.failed };
    }
}