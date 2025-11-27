/**
 * @file 回復適用ロジック
 */
import { Parts } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';

export const applyHeal = ({ world, effect }) => {
    const { targetId, partKey, value } = effect;
    if (!targetId) return effect;

    const part = world.getComponent(targetId, Parts)?.[partKey];
    if (!part) return null;

    let actualHealAmount = 0;
    if (!part.isBroken) {
        const oldHp = part.hp;
        part.hp = Math.min(part.maxHp, part.hp + value);
        actualHealAmount = part.hp - oldHp;
        
        if (actualHealAmount > 0) {
            world.emit(GameEvents.HP_UPDATED, { entityId: targetId, partKey, newHp: part.hp, maxHp: part.maxHp, change: actualHealAmount, isHeal: true });
        }
    }
    
    return { ...effect, value: actualHealAmount };
};