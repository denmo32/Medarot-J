/**
 * @file ダメージ適用ロジック
 * @description ダメージ効果の適用に関するビジネスロジックを担当します。
 */
import { Parts, PlayerInfo } from '../../core/components/index.js';
import { GameEvents } from '../../common/events.js';
import { PartInfo } from '../../common/constants.js';

/**
 * ダメージ効果をターゲットに適用します。
 * HPの更新、パーツ破壊、プレイヤー破壊の判定とイベント発行を行います。
 * @param {object} context - 適用に必要なコンテキスト
 * @param {World} context.world - ワールドオブジェクト
 * @param {object} context.effect - 適用する効果オブジェクト
 * @returns {object | null} 適用結果。貫通ダメージ計算のために追加情報（実ダメージ、破壊フラグなど）を含む。
 */
export const applyDamage = ({ world, effect }) => {
    const { targetId, partKey, value } = effect;
    const part = world.getComponent(targetId, Parts)?.[partKey];
    if (!part) return null;

    const oldHp = part.hp;
    const newHp = Math.max(0, oldHp - value);
    part.hp = newHp;
    const actualDamage = oldHp - newHp;
    const isPartBroken = oldHp > 0 && newHp === 0;

    // HP更新イベントを発行
    world.emit(GameEvents.HP_UPDATED, { entityId: targetId, partKey, newHp, maxHp: part.maxHp, change: -actualDamage, isHeal: false });
    
    // パーツ破壊処理
    if (isPartBroken) {
        part.isBroken = true;
        world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey });
        // 頭部破壊時はプレイヤー破壊イベントも発行
        if (partKey === PartInfo.HEAD.key) {
            world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId, teamId: world.getComponent(targetId, PlayerInfo).teamId });
        }
    }

    // 適用結果を返す (貫通ダメージ計算で使用)
    return { 
        ...effect, 
        value: actualDamage, 
        isPartBroken, 
        overkillDamage: value - actualDamage 
    };
};