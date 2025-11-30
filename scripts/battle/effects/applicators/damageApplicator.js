/**
 * @file ダメージ適用ロジック
 * 副作用を排除し、計算結果のみを返す。
 */
import { Parts, PlayerInfo } from '../../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PartInfo, EffectType } from '../../../common/constants.js'; // PartInfo, EffectTypeは共通定数
import { PlayerStateType } from '../../common/constants.js'; // PlayerStateTypeはBattle固有定数
import { findRandomPenetrationTarget } from '../../utils/queryUtils.js';
import { GameState, ActiveEffects } from '../../components/index.js';

export const applyDamage = ({ world, effect }) => {
    const { targetId, partKey, value } = effect;
    const part = world.getComponent(targetId, Parts)?.[partKey];
    if (!part) return null;

    const oldHp = part.hp;
    const newHp = Math.max(0, oldHp - value);
    
    const actualDamage = oldHp - newHp;
    const isPartBroken = oldHp > 0 && newHp === 0;
    let isPlayerBroken = false;
    let isGuardBroken = false;

    // HP更新イベントは即時UI反映用ではないデータ通知として扱う
    // UI反映は別途制御される
    const events = [];
    events.push({
        type: GameEvents.HP_UPDATED,
        payload: { 
            entityId: targetId, 
            partKey, 
            newHp, 
            oldHp, // アニメーション用に旧値を含める
            maxHp: part.maxHp, 
            change: -actualDamage, 
            isHeal: false 
        }
    });
    
    if (isPartBroken) {
        if (partKey === PartInfo.HEAD.key) {
            isPlayerBroken = true;
        }

        // ガード破壊判定
        const targetState = world.getComponent(targetId, GameState);
        const activeEffects = world.getComponent(targetId, ActiveEffects);
        
        if (targetState && targetState.state === PlayerStateType.GUARDING && activeEffects) {
            const isGuardPart = activeEffects.effects.some(
                e => e.type === EffectType.APPLY_GUARD && e.partKey === partKey
            );
            if (isGuardPart) {
                isGuardBroken = true;
            }
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
        oldHp, // アニメーション用に結果にも含める
        newHp, // アニメーション用に結果にも含める
        isPartBroken, 
        isPlayerBroken,
        isGuardBroken, // フラグを追加
        overkillDamage: overkillDamage,
        nextEffect: nextEffect,
        events: events
    };
};