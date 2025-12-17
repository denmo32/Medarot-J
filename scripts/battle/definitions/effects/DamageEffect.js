/**
 * @file DamageEffect.js
 * @description ダメージ効果の定義。
 * タグベースの状態チェックに更新。
 */
import { PartInfo } from '../../../common/constants.js';
import { EffectType } from '../../common/constants.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { ActiveEffects, IsGuarding } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectService } from '../../services/EffectService.js';

export const DamageEffect = {
    type: EffectType.DAMAGE,

    process: ({ world, sourceId, targetId, effect, part, partOwner, outcome }) => {
        if (!targetId || !outcome.isHit) {
            return null;
        }

        const targetParts = world.getComponent(targetId, Parts);
        if (!targetParts) return null;

        const calcParams = effect.calculation || {};
        const baseStatKey = calcParams.baseStat || 'success';
        const powerStatKey = calcParams.powerStat || 'might';
        const defenseStatKey = calcParams.defenseStat || 'armor';

        const effectiveBaseVal = EffectService.getStatModifier(world, sourceId, baseStatKey, { 
            attackingPart: part, 
            attackerLegs: partOwner.parts.legs 
        }) + (part[baseStatKey] || 0);

        const effectivePowerVal = EffectService.getStatModifier(world, sourceId, powerStatKey, { 
            attackingPart: part, 
            attackerLegs: partOwner.parts.legs 
        }) + (part[powerStatKey] || 0);

        const mobility = targetParts.legs?.mobility || 0;
        const defenseBase = targetParts.legs?.[defenseStatKey] || 0;
        const stabilityDefenseBonus = Math.floor((targetParts.legs?.stability || 0) / 2);
        const totalDefense = defenseBase + stabilityDefenseBonus;

        const finalDamage = CombatCalculator.calculateDamage({
            effectiveBaseVal,
            effectivePowerVal,
            mobility,
            totalDefense,
            isCritical: outcome.isCritical,
            isDefenseBypassed: !outcome.isCritical && outcome.isDefended
        });

        return {
            type: EffectType.DAMAGE,
            targetId: targetId,
            partKey: outcome.finalTargetPartKey, 
            value: finalDamage,
            isCritical: outcome.isCritical,
            isDefended: outcome.isDefended,
        };
    },

    apply: ({ world, effect, simulatedParts }) => {
        const { targetId, partKey, value } = effect;
        const part = simulatedParts?.[partKey];
        if (!part) return null;

        const oldHp = part.hp;
        const newHp = Math.max(0, oldHp - value);
        
        const actualDamage = oldHp - newHp;
        const isPartBroken = oldHp > 0 && newHp === 0;
        let isGuardBroken = false;

        const events = [];
        const stateUpdates = [];

        part.hp = newHp;
        if (isPartBroken) {
            part.isBroken = true;
        }

        events.push({
            type: GameEvents.HP_UPDATED,
            payload: { 
                entityId: targetId, 
                partKey, 
                newHp, 
                oldHp, 
                maxHp: part.maxHp, 
                change: -actualDamage, 
                isHeal: false 
            }
        });
        
        if (isPartBroken) {
            events.push({
                type: GameEvents.PART_BROKEN,
                payload: { entityId: targetId, partKey }
            });

            if (partKey === PartInfo.HEAD.key) {
                simulatedParts.head.isBroken = true;
                stateUpdates.push({ type: 'SetPlayerBroken', targetId });
            }

            // ガードパーツ破壊時の処理
            const activeEffects = world.getComponent(targetId, ActiveEffects);
            const isGuarding = world.getComponent(targetId, IsGuarding);
            
            if (isGuarding && activeEffects) {
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

        const overkillDamage = value - actualDamage;

        return { 
            ...effect, 
            value: actualDamage, 
            oldHp, 
            newHp, 
            isPartBroken, 
            isGuardBroken, 
            overkillDamage: overkillDamage,
            events: events,
            stateUpdates: stateUpdates 
        };
    }
};