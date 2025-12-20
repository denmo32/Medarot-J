/**
 * @file DamageHandler.js
 * @description ダメージ計算と適用のロジック。
 * 貫通処理（再帰的なエフェクト生成）もここで行う。
 */
import { EffectHandler } from './EffectHandler.js';
import { ApplyEffect, EffectContext } from '../../components/effects/Effects.js';
import { Parts } from '../../../components/index.js'; // Common Components
import { ActiveEffects, IsGuarding } from '../../components/index.js'; // Battle Components
import { PartStatus } from '../../components/parts/PartComponents.js';
import { EffectType } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js';
import { HpChangedEvent, PartBrokenEvent } from '../../../components/Events.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { CombatParameterBuilder } from '../../services/CombatParameterBuilder.js';
import { QueryService } from '../../services/QueryService.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';

export class DamageHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { sourceId, targetId, partKey, outcome, attackingPart } = context;

        let finalDamage = effect.value || 0;
        // 貫通時はエフェクトパラメータからクリティカル情報を引き継ぐ、通常時は命中判定結果を使用
        let isCritical = effect.isPenetration ? (effect.params?.isCritical || false) : outcome.isCritical;
        let isDefended = outcome.isDefended;

        // 計算フェーズ (値が未設定の場合のみ計算)
        if (finalDamage === 0 && !effect.isPenetration) {
            const builder = new CombatParameterBuilder(world);
            const params = builder.buildDamageParams({
                sourceId,
                targetId,
                attackingPart,
                outcome
            });
            
            finalDamage = CombatCalculator.calculateDamage(params);
        }

        // 適用フェーズ
        const targetPartsComponent = world.getComponent(targetId, Parts);
        if (!targetPartsComponent || targetPartsComponent[partKey] === null) {
            this.finish(world, effectEntityId, { value: 0 });
            return;
        }

        // パーツIDを取得
        const partEntityId = targetPartsComponent[partKey];
        const partStatus = world.getComponent(partEntityId, PartStatus);

        if (!partStatus) {
            this.finish(world, effectEntityId, { value: 0 });
            return;
        }

        const oldHp = partStatus.hp;
        const newHp = Math.max(0, oldHp - finalDamage);
        const actualDamage = oldHp - newHp;
        
        // 状態更新
        partStatus.hp = newHp;
        
        let isPartBroken = false;
        let isGuardBroken = false;
        const stateUpdates = [];

        if (oldHp > 0 && newHp === 0) {
            isPartBroken = true;
            partStatus.isBroken = true;
            
            const partBrokenEventEntity = world.createEntity();
            world.addComponent(partBrokenEventEntity, new PartBrokenEvent({
                entityId: targetId,
                partKey
            }));

            if (partKey === PartInfo.HEAD.key) {
                stateUpdates.push({ type: 'SetPlayerBroken', targetId });
            }

            // ガードブレイク判定
            const activeEffects = world.getComponent(targetId, ActiveEffects);
            const isGuardingNow = world.getComponent(targetId, IsGuarding);
            if (isGuardingNow && activeEffects) {
                const isGuardPart = activeEffects.effects.some(
                    e => e.type === EffectType.APPLY_GUARD && e.partKey === partKey
                );
                if (isGuardPart) {
                    isGuardBroken = true;
                    stateUpdates.push({
                        type: 'ResetToCooldown',
                        targetId: targetId,
                        options: {}
                    });
                }
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

        // 貫通処理 (再帰的エフェクト生成)
        const overkillDamage = finalDamage - actualDamage;
        if (isPartBroken && overkillDamage > 0 && effect.penetrates) {
            // 頭部生存確認
            const headStatus = world.getComponent(targetPartsComponent.head, PartStatus);
            if (headStatus && !headStatus.isBroken) {
                const nextTargetPartKey = QueryService.findRandomPenetrationTarget(
                    world,
                    targetId,
                    partKey
                );

                if (nextTargetPartKey) {
                    const nextEffectEntity = world.createEntity();
                    world.addComponent(nextEffectEntity, new ApplyEffect({
                        type: EffectType.DAMAGE,
                        value: overkillDamage,
                        calculation: effect.calculation,
                        penetrates: true,
                        isPenetration: true,
                        params: { isCritical }
                    }));
                    world.addComponent(nextEffectEntity, new EffectContext({
                        sourceId,
                        targetId,
                        partKey: nextTargetPartKey,
                        parentId: context.parentId,
                        outcome,
                        attackingPart
                    }));
                }
            }
        }

        const resultData = {
            type: EffectType.DAMAGE,
            targetId,
            partKey,
            value: actualDamage,
            oldHp,
            newHp,
            isCritical,
            isDefended,
            isPartBroken,
            isGuardBroken,
            isPenetration: effect.isPenetration,
            overkillDamage,
            stateUpdates,
            guardianInfo: context.guardianInfo // 必要に応じてコンテキストから引き継ぐ
        };

        this.finish(world, effectEntityId, resultData);
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.DAMAGE];
        const keys = def.keys;
        let messageKey = keys.default;

        if (resultData.isGuardBroken) messageKey = keys.guardBroken;
        else if (resultData.isPenetration) messageKey = keys.penetration;
        else if (resultData.isDefended) messageKey = keys.defended;
        // GuardianInfoはResultDataには直接含まれない場合があるが、文脈上推定可能。
        // ※厳密にはCombatResultSystemで集約されるが、単体EffectResultとしてはここで判定
        
        // パーツ固有のオーバーライドがあれば優先 (例: 特定のパーツだけ特別なメッセージ)
        const overrideKey = visualConfig?.messageKey;
        if (overrideKey) messageKey = overrideKey;

        return { messageKey };
    }
}