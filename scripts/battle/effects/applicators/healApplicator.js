/**
 * @file 回復適用ロジック
 * 副作用を排除。
 */
import { Parts } from '../../../components/index.js';
import { GameEvents } from '../../../common/events.js';

export const applyHeal = ({ world, effect }) => {
    const { targetId, partKey, value } = effect;
    if (!targetId) return effect;

    const part = world.getComponent(targetId, Parts)?.[partKey];
    if (!part) return null;

    let actualHealAmount = 0;
    const events = [];

    if (!part.isBroken) {
        const oldHp = part.hp;
        // part.hp = Math.min(part.maxHp, part.hp + value); // ★削除
        const newHp = Math.min(part.maxHp, part.hp + value);
        actualHealAmount = newHp - oldHp;
        
        if (actualHealAmount > 0) {
            events.push({
                type: GameEvents.HP_UPDATED,
                payload: { entityId: targetId, partKey, newHp: newHp, maxHp: part.maxHp, change: actualHealAmount, isHeal: true }
            });
        }
    }
    
    return { ...effect, value: actualHealAmount, events };
};