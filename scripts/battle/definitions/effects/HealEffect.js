/**
 * @file HealEffect.js
 * @description 回復効果の定義
 */
import { EffectType } from '../../../common/constants.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { Action } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';
import { PartKeyToInfoMap } from '../../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';

export const HealEffect = {
    type: EffectType.HEAL,

    process: ({ world, sourceId, targetId, effect, part }) => {
        if (targetId === null || targetId === undefined) {
            return { type: EffectType.HEAL, value: 0 };
        }

        const targetParts = world.getComponent(targetId, Parts);
        if (!targetParts) return null;
        
        const powerStat = effect.calculation?.powerStat || 'might';
        const healAmount = part[powerStat] || 0;
        
        const targetPartKey = world.getComponent(sourceId, Action)?.targetPartKey;
        if (!targetPartKey) return null;

        return {
            type: EffectType.HEAL,
            targetId: targetId,
            partKey: targetPartKey,
            value: healAmount,
        };
    },

    apply: ({ world, effect }) => {
        const { targetId, partKey, value } = effect;
        if (!targetId) return effect;

        const part = world.getComponent(targetId, Parts)?.[partKey];
        if (!part) return null;

        let actualHealAmount = 0;
        let oldHp = part.hp;
        let newHp = part.hp;
        const events = [];
        const stateUpdates = [];

        if (!part.isBroken) {
            oldHp = part.hp;
            newHp = Math.min(part.maxHp, part.hp + value);
            actualHealAmount = newHp - oldHp;
            
            // データ駆動更新
            stateUpdates.push({
                type: 'UPDATE_COMPONENT',
                targetId,
                componentType: Parts,
                updates: {
                    [partKey]: { hp: newHp }
                }
            });
            
            if (actualHealAmount > 0) {
                events.push({
                    type: GameEvents.HP_UPDATED,
                    payload: { 
                        entityId: targetId, 
                        partKey, 
                        newHp: newHp, 
                        oldHp: oldHp, 
                        maxHp: part.maxHp, 
                        change: actualHealAmount, 
                        isHeal: true 
                    }
                });
            }
        }
        
        return { 
            ...effect, 
            value: actualHealAmount, 
            oldHp,
            newHp,
            events,
            stateUpdates
        };
    },

    createVisuals: ({ world, effects, messageGenerator }) => {
        const visuals = [];
        const messageLines = [];

        effects.forEach(effect => {
            if (effect.value > 0) {
                const targetInfo = world.getComponent(effect.targetId, PlayerInfo);
                const partName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
                messageLines.push(messageGenerator.format(MessageKey.HEAL_SUCCESS, { 
                    targetName: targetInfo.name, 
                    partName: partName, 
                    healAmount: effect.value 
                }));
            } else {
                messageLines.push(messageGenerator.format(MessageKey.HEAL_FAILED));
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