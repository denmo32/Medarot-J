/**
 * @file 妨害(Glitch)効果適用ロジック
 * @description 妨害効果の適用に関するビジネスロジックを担当します。
 */
import { GameEvents } from '../../../common/events.js';
import { ActionCancelReason } from '../../../config/constants.js';

/**
 * 妨害効果をターゲットに適用します。
 * このApplicatorは直接状態を変更せず、他のシステム（CooldownSystemなど）が処理するための
 * ACTION_CANCELLEDイベントを発行する責務を持ちます。
 * @param {object} context - 適用に必要なコンテキスト
 * @param {World} context.world - ワールドオブジェクト
 * @param {object} context.effect - 適用する効果オブジェクト
 * @returns {object | null} 適用結果。効果の成否を含む。
 */
export const applyGlitch = ({ world, effect }) => {
    // 妨害が成功した場合のみイベントを発行
    if (effect.wasSuccessful) {
        world.emit(GameEvents.ACTION_CANCELLED, { 
            entityId: effect.targetId, 
            reason: ActionCancelReason.INTERRUPTED 
        });
    }
    
    // このApplicatorは状態を直接変更しないため、元のeffectをそのまま返す
    return effect;
};