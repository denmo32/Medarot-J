/**
 * @file 回復適用ロジック
 * @description 回復効果の適用に関するビジネスロジックを担当します。
 */
import { Parts } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';

/**
 * 回復効果をターゲットに適用します。
 * @param {object} context - 適用に必要なコンテキスト
 * @param {World} context.world - ワールドオブジェクト
 * @param {object} context.effect - 適用する効果オブジェクト
 * @returns {object | null} 適用結果。実際に回復した量を含む。
 */
export const applyHeal = ({ world, effect }) => {
    const { targetId, partKey, value } = effect;
    // 回復対象がいない場合
    if (!targetId) return effect;

    const part = world.getComponent(targetId, Parts)?.[partKey];
    if (!part) return null;

    let actualHealAmount = 0;
    // 破壊されていないパーツのみ回復可能
    if (!part.isBroken) {
        const oldHp = part.hp;
        part.hp = Math.min(part.maxHp, part.hp + value);
        actualHealAmount = part.hp - oldHp;
        
        // HPが実際に変動した場合のみイベントを発行
        if (actualHealAmount > 0) {
            world.emit(GameEvents.HP_UPDATED, { entityId: targetId, partKey, newHp: part.hp, maxHp: part.maxHp, change: actualHealAmount, isHeal: true });
        }
    }
    
    // 適用結果を返す
    return { ...effect, value: actualHealAmount };
};