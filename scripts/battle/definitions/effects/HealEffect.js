/**
 * @file HealEffect.js
 * @description 回復効果の定義
 * createVisualsメソッドは削除され、VisualSequenceServiceとVisualDefinitionsに責務が移譲されました。
 */
import { EffectType } from '../../common/constants.js';
import { Parts } from '../../../components/index.js';
import { Action } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';

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

    apply: ({ world, effect, simulatedParts }) => {
        const { targetId, partKey, value } = effect;
        if (!targetId) return effect;

        const part = simulatedParts?.[partKey];
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
            
            // シミュレーション状態を直接更新
            part.hp = newHp;
            
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
    }
};