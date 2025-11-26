/**
 * @file ダメージ適用ロジック
 * @description ダメージ効果の適用に関するビジネスロジックを担当します。
 */
import { Parts, PlayerInfo } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PartInfo } from '../../../config/constants.js';
import { findRandomPenetrationTarget } from '../../utils/queryUtils.js';

/**
 * ダメージ効果をターゲットに適用します。
 * HPの更新、パーツ破壊、プレイヤー破壊の判定とイベント発行を行います。
 * 貫通ダメージが発生した場合、次の効果を生成して返します。
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
    let isPlayerBroken = false; // プレイヤー破壊フラグを追加

    // HP更新イベントを発行
    world.emit(GameEvents.HP_UPDATED, { entityId: targetId, partKey, newHp, maxHp: part.maxHp, change: -actualDamage, isHeal: false });
    
    // パーツ破壊処理
    if (isPartBroken) {
        part.isBroken = true;
        // 頭部破壊時はプレイヤー破壊フラグを立てる
        if (partKey === PartInfo.HEAD.key) {
            isPlayerBroken = true;
        }
    }

    // 貫通ダメージの連鎖ロジック
    let nextEffect = null;
    const overkillDamage = value - actualDamage;
    if (isPartBroken && effect.penetrates && overkillDamage > 0) {
        const nextTargetPartKey = findRandomPenetrationTarget(world, targetId, partKey);
        if (nextTargetPartKey) {
            // 次の貫通ダメージ効果を生成
            nextEffect = { 
                ...effect, 
                partKey: nextTargetPartKey, 
                value: overkillDamage, 
                isPenetration: true 
            };
        }
    }

    // 適用結果を返す (貫通ダメージ計算で使用)
    return { 
        ...effect, 
        value: actualDamage, 
        isPartBroken, 
        isPlayerBroken, // プレイヤー破壊フラグを結果に含める
        overkillDamage: overkillDamage,
        nextEffect: nextEffect, // 次の効果を追加
    };
};