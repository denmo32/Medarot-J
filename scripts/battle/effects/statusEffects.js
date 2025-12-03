/**
 * @file 状態関連効果戦略定義
 */
import { ActiveEffects, GameState, Action } from '../components/index.js';
import { PlayerInfo } from '../../components/index.js';
import { EffectType, EffectScope } from '../../common/constants.js';
import { PlayerStateType } from '../common/constants.js';
import { TargetingService } from '../services/TargetingService.js';

const APPLY_SCAN = ({ world, sourceId, effect, part }) => {
    const sourceInfo = world.getComponent(sourceId, PlayerInfo);
    if (!sourceInfo) return null;

    // パラメータを定義ファイルから取得
    const params = effect.params || {};
    const valueSource = params.valueSource || 'might';
    const valueFactor = params.valueFactor || 0.1;
    const duration = params.duration || 3;

    const baseValue = part[valueSource] || 0;
    const scanBonusValue = Math.floor(baseValue * valueFactor);

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

    // 将来的にここも effect.params で成功条件などを指定可能にできる
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
    const params = effect.params || {};
    const countSource = params.countSource || 'might';
    const countFactor = params.countFactor || 0.1;
    
    const baseValue = part[countSource] || 0;
    const guardCount = Math.floor(baseValue * countFactor);
    
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