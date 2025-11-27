/**
 * @file ダメージ適用ロジック
 * 副作用（イベント発行）を排除し、発行すべきイベント情報を返すように変更。
 */
import { Parts } from '../../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PartInfo } from '../../../common/constants.js';
import { findRandomPenetrationTarget } from '../../utils/queryUtils.js';

export const applyDamage = ({ world, effect }) => {
    const { targetId, partKey, value } = effect;
    const part = world.getComponent(targetId, Parts)?.[partKey];
    if (!part) return null;

    const oldHp = part.hp;
    const newHp = Math.max(0, oldHp - value);
    part.hp = newHp;
    const actualDamage = oldHp - newHp;
    const isPartBroken = oldHp > 0 && newHp === 0;
    let isPlayerBroken = false;

    // 副作用としてのイベント発行を削除し、結果オブジェクトに含める
    const events = [];
    events.push({
        type: GameEvents.HP_UPDATED,
        payload: { entityId: targetId, partKey, newHp, maxHp: part.maxHp, change: -actualDamage, isHeal: false }
    });
    
    if (isPartBroken) {
        part.isBroken = true;
        if (partKey === PartInfo.HEAD.key) {
            isPlayerBroken = true;
        }
    }

    let nextEffect = null;
    const overkillDamage = value - actualDamage;
    if (isPartBroken && effect.penetrates && overkillDamage > 0) {
        const nextTargetPartKey = findRandomPenetrationTarget(world, targetId, partKey);
        if (nextTargetPartKey) {
            nextEffect = { 
                ...effect, 
                partKey: nextTargetPartKey, 
                value: overkillDamage, 
                isPenetration: true 
            };
        }
    }

    return { 
        ...effect, 
        value: actualDamage, 
        isPartBroken, 
        isPlayerBroken,
        overkillDamage: overkillDamage,
        nextEffect: nextEffect,
        events: events // イベント情報を返す
    };
};