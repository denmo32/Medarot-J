/**
 * @file VisualSequenceService.js
 * @description 戦闘結果から演出シーケンスを生成するサービス。
 * BattleResolutionServiceから演出生成ロジックを分離する。
 */
import { MessageService } from './MessageService.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js';
import { GameEvents } from '../../common/events.js';
import { PartInfo } from '../../common/constants.js';

export class VisualSequenceService {

    /**
     * 戦闘コンテキストから演出シーケンスを生成する
     * @param {object} ctx - 戦闘コンテキスト
     * @returns {Array} 演出シーケンスオブジェクトの配列
     */
    static generateVisualSequence(ctx) {
        let visuals = [];
        const defeatedPlayers = new Map();

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
            
            // 頭部破壊による機能停止情報を収集
            appliedEffects.forEach(effect => {
                if (effect.isPartBroken && effect.partKey === PartInfo.HEAD.key) {
                    defeatedPlayers.set(effect.targetId, true);
                }
            });

        } else if (!ctx.outcome.isHit && ctx.intendedTargetId) {
            visuals.push(...new MessageService(ctx.world).createResultSequence(ctx));
        }

        // HPバーアニメーションタスクの位置を探す
        const hpAnimIndex = visuals.findIndex(v => v.type === 'UI_ANIMATION' && v.targetType === 'HP_BAR');

        if (hpAnimIndex !== -1) {
            // HPバーアニメーションの後に機能停止演出を追加
            const defeatTasks = [];
            for (const [playerId] of defeatedPlayers) {
                defeatTasks.push({ type: 'APPLY_VISUAL_EFFECT', targetId: playerId, className: 'is-defeated' });
            }
            if (defeatTasks.length > 0) {
                visuals.splice(hpAnimIndex + 1, 0, ...defeatTasks);
            }
        } else if (defeatedPlayers.size > 0) {
            // HPバーアニメーションがない場合でも、主要なメッセージ表示の後に追加
            const dialogIndex = visuals.map(v => v.type).lastIndexOf('DIALOG');
            const insertIndex = dialogIndex !== -1 ? dialogIndex + 1 : visuals.length;
            const defeatTasks = [];
            for (const [playerId] of defeatedPlayers) {
                defeatTasks.push({ type: 'APPLY_VISUAL_EFFECT', targetId: playerId, className: 'is-defeated' });
            }
            if (defeatTasks.length > 0) {
                visuals.splice(insertIndex, 0, ...defeatTasks);
            }
        }

        visuals.push({ type: 'EVENT', eventName: GameEvents.REFRESH_UI });
        visuals.push({ type: 'EVENT', eventName: GameEvents.CHECK_ACTION_CANCELLATION });

        return visuals;
    }
}