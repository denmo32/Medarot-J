/**
 * @file ダメージ適用ロジック
 * 副作用を排除し、計算結果のみを返す。
 * 貫通ターゲットの決定などの「次」の処理は行わず、
 * 純粋にこの適用の結果（破壊されたか、余剰ダメージはいくらか）のみを返す。
 */
import { Parts } from '../../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PartInfo, EffectType } from '../../../common/constants.js';
import { PlayerStateType } from '../../common/constants.js';
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
    const events = [];
    events.push({
        type: GameEvents.HP_UPDATED,
        payload: { 
            entityId: targetId, 
            partKey, 
            newHp, 
            oldHp, 
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

    const overkillDamage = value - actualDamage;

    // nextEffectの生成ロジックを削除し、結果報告のみを行う
    return { 
        ...effect, 
        value: actualDamage,
        oldHp, 
        newHp, 
        isPartBroken, 
        isPlayerBroken,
        isGuardBroken, 
        overkillDamage: overkillDamage, // 余剰ダメージ量は報告する
        events: events
    };
};