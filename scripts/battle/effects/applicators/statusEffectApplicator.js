/**
 * @file ステータス効果適用ロジック
 * @description スキャン、ガードなどのステータス変化効果の適用を担当します。
 */
import { ActiveEffects, PlayerInfo } from '../../components/index.js';
import { getValidAllies } from '../../utils/queryUtils.js';

/**
 * 単一のターゲットに効果を適用するヘルパー関数。
 * @param {World} world - ワールドオブジェクト
 * @param {object} effect - 適用する効果オブジェクト
 */
const applySingleEffect = (world, effect) => {
    const activeEffects = world.getComponent(effect.targetId, ActiveEffects);
    if (!activeEffects) return;
    
    // 同種の効果は上書きする（重複させない）
    activeEffects.effects = activeEffects.effects.filter(e => e.type !== effect.type);
    
    // 新しい効果を追加
    activeEffects.effects.push({
        type: effect.type,
        value: effect.value,
        duration: effect.duration,
        count: effect.value, // ガード回数などに使用
        partKey: effect.partKey, // どのパーツによる効果かを記録
    });
};

/**
 * チーム全体に効果を適用します（例: スキャン）。
 * @param {object} context - 適用に必要なコンテキスト
 * @returns {object} 適用した効果オブジェクト
 */
export const applyTeamEffect = ({ world, effect }) => {
    if (!effect.scope?.endsWith('_TEAM')) return effect;
    
    const sourceInfo = world.getComponent(effect.targetId, PlayerInfo);
    if (!sourceInfo) return effect;
    
    // 自分を含む味方全体を取得
    const allies = getValidAllies(world, effect.targetId, true);
    allies.forEach(id => applySingleEffect(world, { ...effect, targetId: id }));
    
    return effect;
};

/**
 * 使用者自身に効果を適用します（例: ガード）。
 * @param {object} context - 適用に必要なコンテキスト
 * @returns {object} 適用した効果オブジェクト
 */
export const applySelfEffect = ({ world, effect }) => {
    applySingleEffect(world, effect);
    return effect;
};
