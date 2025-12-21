/**
 * @file DamageHandler.js
 * @description ダメージ計算と適用のロジック。
 */
import { EffectHandler } from './EffectHandler.js';
import { ApplyEffect, EffectContext } from '../../components/effects/Effects.js';
import { Parts } from '../../../components/index.js'; // Common
import { ActiveEffects, IsGuarding } from '../../components/index.js'; // Battle
import { PartStatus } from '../../components/parts/PartComponents.js';
import { EffectType } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js';
import { HpChangedEvent, PartBrokenEvent } from '../../../components/Events.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { buildDamageParams } from '../../logic/CombatParameterBuilder.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';
import { TraitRegistry } from '../../registries/TraitRegistry.js';
import { HookPhase } from '../../registries/HookRegistry.js';

export class DamageHandler extends EffectHandler {
    apply(world, effectEntityId, effect, context) {
        const { sourceId, targetId, partKey, outcome, attackingPart } = context;

        let finalDamage = effect.value || 0;
        let isCritical = effect.isPenetration ? (effect.params?.isCritical || false) : outcome.isCritical;
        let isDefended = outcome.isDefended;

        if (finalDamage === 0 && !effect.isPenetration) {
            const params = buildDamageParams(world, {
                sourceId,
                targetId,
                attackingPart,
                outcome
            });
            finalDamage = CombatCalculator.calculateDamage(params);
        }

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

        const oldHp = partStatus.hp;
        const newHp = Math.max(0, oldHp - finalDamage);
        const actualDamage = oldHp - newHp;
        
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

        const overkillDamage = finalDamage - actualDamage;
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
            guardianInfo: context.guardianInfo
        };

        if (effect.penetrates) {
            TraitRegistry.executeTraitLogic('PENETRATE', HookPhase.AFTER_EFFECT_APPLIED, {
                world,
                effectResult: resultData,
                effectContext: context,
                originalEffect: effect
            });
        }

        this.finish(world, effectEntityId, resultData);
    }

    resolveVisual(resultData, visualConfig) {
        const def = VisualDefinitions[EffectType.DAMAGE];
        const keys = def.keys;
        let messageKey = keys.default;

        if (resultData.isGuardBroken) messageKey = keys.guardBroken;
        else if (resultData.isPenetration) messageKey = keys.penetration;
        else if (resultData.isDefended) messageKey = keys.defended;
        
        const overrideKey = visualConfig?.messageKey;
        if (overrideKey) messageKey = overrideKey;

        return { messageKey };
    }
}
