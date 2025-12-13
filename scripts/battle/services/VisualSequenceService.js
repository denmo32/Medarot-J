/**
 * @file VisualSequenceService.js
 * @description 戦闘結果から演出シーケンスを生成するサービス。
 * BattleResolutionServiceから演出生成ロジックを分離する。
 */
import { MessageService } from './MessageService.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js';
import { GameEvents } from '../../common/events.js';

export class VisualSequenceService {

    /**
     * 戦闘コンテキストから演出シーケンスを生成する
     * @param {object} ctx - 戦闘コンテキスト
     * @returns {Array} 演出シーケンスオブジェクトの配列
     */
    static generateVisualSequence(ctx) {
        let visuals = [];

        const { attackerId, intendedTargetId, finalTargetId, guardianInfo, appliedEffects } = ctx;

        const animationTargetId = intendedTargetId || finalTargetId;
        visuals.push({
            type: 'ANIMATE',
            animationType: animationTargetId ? 'attack' : 'support',
            attackerId,
            targetId: animationTargetId
        });

        visuals.push(...new MessageService(ctx.world).createDeclarationSequence(ctx));

        if (appliedEffects && appliedEffects.length > 0) {
            const mainEffectType = appliedEffects[0].type;
            visuals.push(...EffectRegistry.createVisuals(mainEffectType, {
                world: ctx.world,
                effects: appliedEffects,
                guardianInfo,
                messageGenerator: new MessageService(ctx.world) // Temporary: for compatibility
            }));
        } else if (!ctx.outcome.isHit && ctx.intendedTargetId) {
            visuals.push(...new MessageService(ctx.world).createResultSequence(ctx));
        }

        visuals.push({ type: 'EVENT', eventName: GameEvents.REFRESH_UI });
        visuals.push({ type: 'EVENT', eventName: GameEvents.CHECK_ACTION_CANCELLATION });

        return visuals;
    }
}