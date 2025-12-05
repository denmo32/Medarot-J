/**
 * @file 妨害(Glitch)効果適用ロジック
 * 副作用（イベント発行）を排除し、発行すべきイベント情報を返すように変更。
 */
import { GameEvents } from '../../../common/events.js';
import { ActionCancelReason } from '../../common/constants.js';

export const applyGlitch = ({ world, effect }) => {
    const events = [];
    
    // 妨害が成功した場合のみイベントを発行リストに追加
    if (effect.wasSuccessful) {
        events.push({
            type: GameEvents.ACTION_CANCELLED,
            payload: { 
                entityId: effect.targetId, 
                reason: ActionCancelReason.INTERRUPTED 
            }
        });
        // 冷却へ強制移行
        events.push({
            type: GameEvents.REQUEST_RESET_TO_COOLDOWN,
            payload: {
                entityId: effect.targetId,
                options: { interrupted: true }
            }
        });
    }
    
    return { ...effect, events };
};