/**
 * @file DamageEffect.js
 * @description ダメージ効果の定義 (計算・適用・演出)
 */
import { PartInfo } from '../../../common/constants.js';
import { EffectType, PlayerStateType, ModalType } from '../../common/constants.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { GameState, ActiveEffects } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { PartKeyToInfoMap } from '../../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';
import { EffectService } from '../../services/EffectService.js';

export const DamageEffect = {
    type: EffectType.DAMAGE,

    // --- 計算フェーズ ---
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

    // --- 適用データ生成フェーズ ---
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

        // シミュレーション状態を直接更新
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
                stateUpdates.push({ type: 'SET_PLAYER_BROKEN', targetId });
            }

            const targetState = world.getComponent(targetId, GameState);
            const activeEffects = world.getComponent(targetId, ActiveEffects);
            
            if (targetState && targetState.state === PlayerStateType.GUARDING && activeEffects) {
                const isGuardPart = activeEffects.effects.some(
                    e => e.type === EffectType.APPLY_GUARD && e.partKey === partKey
                );
                if (isGuardPart) {
                    isGuardBroken = true;
                    stateUpdates.push({
                        type: 'RESET_TO_COOLDOWN',
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
    },

    // --- 演出指示データ生成フェーズ ---
    createVisuals: ({ world, effects, guardianInfo, messageGenerator }) => {
        const visuals = [];
        const messageLines = [];
        const firstEffect = effects[0];
        let prefix = firstEffect.isCritical ? messageGenerator.format(MessageKey.CRITICAL_HIT) : '';

        effects.forEach((effect, index) => {
            const targetInfo = world.getComponent(effect.targetId, PlayerInfo);
            const partName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
            
            const params = {
                targetName: targetInfo?.name || '不明',
                guardianName: guardianInfo?.name || '不明',
                partName: partName,
                damage: effect.value,
            };

            if (index === 0) {
                if (guardianInfo) {
                    messageLines.push(prefix + messageGenerator.format(MessageKey.GUARDIAN_DAMAGE, params));
                } else if (effect.isDefended) {
                    messageLines.push(prefix + messageGenerator.format(MessageKey.DEFENSE_SUCCESS, params));
                } else {
                    messageLines.push(prefix + messageGenerator.format(MessageKey.DAMAGE_APPLIED, params));
                }
            } else {
                if (effect.isPenetration) {
                     messageLines.push(messageGenerator.format(MessageKey.PENETRATION_DAMAGE, params));
                }
            }

            if (effect.isGuardBroken) {
                messageLines.push(messageGenerator.format(MessageKey.GUARD_BROKEN));
            }
        });

        if (messageLines.length > 0) {
            visuals.push({
                type: 'DIALOG',
                text: messageLines[0],
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
            if (effects.some(e => e.value > 0)) {
                visuals.push({
                    type: 'UI_ANIMATION',
                    targetType: 'HP_BAR',
                    data: { effects }
                });
            }
            for (let i = 1; i < messageLines.length; i++) {
                visuals.push({
                    type: 'DIALOG',
                    text: messageLines[i],
                    options: { modalType: ModalType.EXECUTION_RESULT }
                });
            }
        }

        return visuals;
    }
};