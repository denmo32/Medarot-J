// scripts/battleUtils.js:

import { CONFIG } from './config.js';

/**
 * ダメージ計算を行う関数
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {number} targetId - ターゲットのエンティティID
 * @param {Action} action - 攻撃者が選択したアクション
 * @returns {number} 計算されたダメージ値
 */
export function calculateDamage(world, attackerId, targetId, action) {
    // 将来的には、ここからパーツの攻撃力、防御力、相性などを考慮した
    // 複雑なダメージ計算ロジックを実装できます。
    // 例: const attackerParts = world.getComponent(attackerId, Parts);
    // 例: const power = attackerParts[action.partKey].power;
    
    // 現在は設定ファイルに基づいた基本ダメージを返します。
    return CONFIG.BASE_DAMAGE;
}