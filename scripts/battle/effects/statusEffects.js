/**
 * @file 状態関連効果戦略定義
 */
import { PlayerInfo, ActiveEffects, GameState, Action } from '../components/index.js';
import { EffectType, EffectScope, PlayerStateType } from '../common/constants.js';
import { getValidAllies } from '../utils/queryUtils.js';

const APPLY_SCAN = ({ world, sourceId, effect, part }) => {
    const sourceInfo = world.getComponent(sourceId, PlayerInfo);
    if (!sourceInfo) return null;

    const powerSource = effect.powerSource || 'might';
    const scanBonusValue = Math.floor(part[powerSource] / 10);
    const duration = effect.duration || 3;

    return {
        type: EffectType.APPLY_SCAN,
        scope: EffectScope.ALLY_TEAM, 
        targetId: sourceId,
        value: scanBonusValue,
        duration: duration,
    };
};

const APPLY_GLITCH = ({ world, targetId }) => {
    if (targetId === null || targetId === undefined) return null;

    const targetInfo = world.getComponent(targetId, PlayerInfo);
    const targetState = world.getComponent(targetId, GameState);
    if (!targetInfo || !targetState) return null;

    let wasSuccessful = false;

    if (targetState.state === PlayerStateType.SELECTED_CHARGING || targetState.state === PlayerStateType.GUARDING) {
        wasSuccessful = true;
    } else {
        wasSuccessful = false;
    }

    return {
        type: EffectType.APPLY_GLITCH,
        targetId: targetId,
        wasSuccessful: wasSuccessful,
    };
};

const APPLY_GUARD = ({ world, sourceId, effect, part, partKey }) => {
    const powerSource = effect.powerSource || 'might';
    const countMultiplier = effect.countMultiplier || 0.1;
    const guardCount = Math.floor(part[powerSource] * countMultiplier);
    
    return {
        type: EffectType.APPLY_GUARD,
        targetId: sourceId,
        value: guardCount,
        partKey: partKey,
    };
};

export const statusEffects = {
    [EffectType.APPLY_SCAN]: APPLY_SCAN,
    [EffectType.APPLY_GLITCH]: APPLY_GLITCH,
    [EffectType.APPLY_GUARD]: APPLY_GUARD,
};