/**
 * @file ダメージ適用ロジック
 * 副作用を排除し、計算結果のみを返す。
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
    // part.hp = newHp; // ★削除: ここで書き換えない！
    
    const actualDamage = oldHp - newHp;
    const isPartBroken = oldHp > 0 && newHp === 0;
    let isPlayerBroken = false;

    const events = [];
    events.push({
        type: GameEvents.HP_UPDATED,
        payload: { entityId: targetId, partKey, newHp, maxHp: part.maxHp, change: -actualDamage, isHeal: false }
    });
    
    // isPartBrokenの判定はここで行うが、実際のフラグセットは行わない
    if (isPartBroken) {
        // part.isBroken = true; // ★削除
        if (partKey === PartInfo.HEAD.key) {
            isPlayerBroken = true;
        }
    }

    let nextEffect = null;
    const overkillDamage = value - actualDamage;
    // 貫通判定のためには、次のターゲットを探す必要があるが、
    // 現在のパーツが壊れた前提で探す必要がある。
    // queryUtilsのfindRandomPenetrationTargetは現在のisBrokenを見ているため、
    // ここでisBrokenになっていないと、同じパーツを選んでしまう可能性がある？
    // -> findRandomPenetrationTargetのexcludedPartKey引数で現在のパーツを除外すればOK。
    
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
        events: events
    };
};