/**
 * @file ステータス効果適用ロジック
 */
import { ActiveEffects } from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';
import { getValidAllies } from '../../utils/queryUtils.js';

// 状態変更のみを行い、特にイベントを発行しないヘルパー関数
const applySingleEffect = (world, effect) => {
    const activeEffects = world.getComponent(effect.targetId, ActiveEffects);
    if (!activeEffects) return;
    
    activeEffects.effects = activeEffects.effects.filter(e => e.type !== effect.type);
    
    activeEffects.effects.push({
        type: effect.type,
        value: effect.value,
        duration: effect.duration,
        count: effect.value,
        partKey: effect.partKey,
    });
};

export const applyTeamEffect = ({ world, effect }) => {
    if (!effect.scope?.endsWith('_TEAM')) return { ...effect, events: [] };
    
    const sourceInfo = world.getComponent(effect.targetId, PlayerInfo);
    if (!sourceInfo) return { ...effect, events: [] };
    
    const allies = getValidAllies(world, effect.targetId, true);
    allies.forEach(id => applySingleEffect(world, { ...effect, targetId: id }));
    
    return { ...effect, events: [] };
};

export const applySelfEffect = ({ world, effect }) => {
    applySingleEffect(world, effect);
    return { ...effect, events: [] };
};