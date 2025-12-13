/**
 * @file VisualSequenceService.js
 * @description 戦闘結果から演出シーケンスを生成するサービス。
 * リファクタリング: VisualDefinitions と BattleLogType を利用して、
 * ロジックから具体的な演出指示を分離・生成する。
 */
import { MessageService } from './MessageService.js';
import { GameEvents } from '../../common/events.js';
import { PartInfo, PartKeyToInfoMap } from '../../common/constants.js';
import { BattleLogType, ModalType } from '../common/constants.js';
import { VisualDefinitions } from '../../data/visualDefinitions.js';
import { PlayerInfo } from '../../components/index.js';

export class VisualSequenceService {

    /**
     * 戦闘コンテキストから演出シーケンスを生成する
     * @param {object} ctx - 戦闘コンテキスト
     * @returns {Array} 演出シーケンスオブジェクトの配列
     */
    static generateVisualSequence(ctx) {
        const resolutionLog = this._buildResolutionLog(ctx);
        const sequence = [];
        const messageService = new MessageService(ctx.world);
        const defeatedPlayers = new Set();

        for (const log of resolutionLog) {
            switch (log.type) {
                case BattleLogType.DECLARATION:
                    sequence.push(...this._createDeclarationTasks(log, ctx, messageService));
                    break;
                case BattleLogType.GUARDIAN_TRIGGER:
                    sequence.push(...this._createGuardianTasks(log, ctx, messageService));
                    break;
                case BattleLogType.ANIMATION_START:
                    sequence.push({
                        type: 'ANIMATE',
                        animationType: log.targetId ? 'attack' : 'support',
                        attackerId: log.actorId,
                        targetId: log.targetId
                    });
                    break;
                case BattleLogType.EFFECT:
                    sequence.push(...this._createEffectTasks(log, ctx, messageService));
                    // 機能停止判定の収集
                    if (log.effect.isPartBroken && log.effect.partKey === PartInfo.HEAD.key) {
                        defeatedPlayers.add(log.effect.targetId);
                    }
                    break;
                case BattleLogType.MISS:
                    sequence.push(...this._createMissTasks(log, ctx, messageService));
                    break;
            }
        }

        // HPバーアニメーションタスクの位置を探し、その後に機能停止演出を挿入
        this._insertDefeatVisuals(sequence, defeatedPlayers);

        // システム的なイベントタスクを追加
        sequence.push({ type: 'EVENT', eventName: GameEvents.REFRESH_UI });
        sequence.push({ type: 'EVENT', eventName: GameEvents.CHECK_ACTION_CANCELLATION });

        return sequence;
    }

    /**
     * コンテキストから論理的なログ（イベント順序）を再構成する
     */
    static _buildResolutionLog(ctx) {
        const log = [];
        const { attackerId, intendedTargetId, finalTargetId, guardianInfo, appliedEffects, isSupport, outcome } = ctx;

        // 1. アニメーション開始 (ターゲットへ向く、またはその場で実行)
        const animationTargetId = intendedTargetId || finalTargetId;
        log.push({ 
            type: BattleLogType.ANIMATION_START, 
            actorId: attackerId, 
            targetId: animationTargetId 
        });

        // 2. 行動宣言
        log.push({ 
            type: BattleLogType.DECLARATION, 
            actorId: attackerId,
            targetId: finalTargetId, // ターゲット不在ならnull
            isSupport: isSupport 
        });

        // 3. ガード発動 (ターゲットが変更された場合)
        if (guardianInfo) {
            log.push({ 
                type: BattleLogType.GUARDIAN_TRIGGER, 
                guardianInfo: guardianInfo 
            });
        }

        // 4. 効果適用 or ミス
        if (appliedEffects && appliedEffects.length > 0) {
            for (const effect of appliedEffects) {
                log.push({ 
                    type: BattleLogType.EFFECT, 
                    effect: effect 
                });
            }
        } else if (!outcome.isHit && intendedTargetId) {
            // 命中せず、かつ意図したターゲットがいた場合（空振り）
            log.push({ 
                type: BattleLogType.MISS, 
                targetId: intendedTargetId 
            });
        }

        return log;
    }

    // --- Task Creation Helpers ---

    static _createDeclarationTasks(log, ctx, messageService) {
        const def = VisualDefinitions.DECLARATION;
        const messageKey = def.getMessageKey({ ...ctx, targetId: log.targetId });
        
        if (!messageKey) return [];

        const attackerInfo = ctx.world.getComponent(log.actorId, PlayerInfo);
        const params = {
            attackerName: attackerInfo?.name || '???',
            actionType: ctx.attackingPart.action,
            attackType: ctx.attackingPart.type,
            trait: ctx.attackingPart.trait,
        };

        return [{
            type: 'DIALOG',
            text: messageService.format(messageKey, params),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        }];
    }

    static _createGuardianTasks(log, ctx, messageService) {
        const def = VisualDefinitions.GUARDIAN_TRIGGER;
        const messageKey = def.getMessageKey();
        
        return [{
            type: 'DIALOG',
            text: messageService.format(messageKey, { guardianName: log.guardianInfo.name }),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        }];
    }

    static _createEffectTasks(log, ctx, messageService) {
        const effect = log.effect;
        const def = VisualDefinitions[effect.type];
        if (!def) return [];

        const tasks = [];
        
        // メッセージ生成
        const prefixKey = def.getPrefixKey ? def.getPrefixKey(effect) : null;
        const messageKey = def.getMessageKey(effect);
        
        if (messageKey) {
            const targetInfo = ctx.world.getComponent(effect.targetId, PlayerInfo);
            const partName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
            const guardianName = ctx.guardianInfo?.name || '不明';

            const params = {
                targetName: targetInfo?.name || '不明',
                guardianName: guardianName,
                partName: partName,
                damage: effect.value,
                healAmount: effect.value,
                scanBonus: effect.value,
                duration: effect.duration,
                guardCount: effect.value,
                actorName: targetInfo?.name || '???' // CONSUME_GUARD用
            };

            let text = messageService.format(messageKey, params);
            if (prefixKey) {
                text = messageService.format(prefixKey) + text;
            }

            tasks.push({
                type: 'DIALOG',
                text: text,
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
        }

        // HPバーアニメーション
        if (def.shouldShowHpBar && def.shouldShowHpBar(effect)) {
            tasks.push({
                type: 'UI_ANIMATION',
                targetType: 'HP_BAR',
                data: { appliedEffects: [effect] }
            });
        }

        return tasks;
    }

    static _createMissTasks(log, ctx, messageService) {
        const def = VisualDefinitions.MISS;
        const messageKey = def.getMessageKey();
        const targetInfo = ctx.world.getComponent(log.targetId, PlayerInfo);

        return [{
            type: 'DIALOG',
            text: messageService.format(messageKey, { targetName: targetInfo?.name || '相手' }),
            options: { modalType: ModalType.EXECUTION_RESULT }
        }];
    }

    static _insertDefeatVisuals(sequence, defeatedPlayers) {
        if (defeatedPlayers.size === 0) return;

        const defeatTasks = [];
        for (const playerId of defeatedPlayers) {
            defeatTasks.push({ type: 'APPLY_VISUAL_EFFECT', targetId: playerId, className: 'is-defeated' });
        }

        // HPバーアニメーションの後、またはメッセージの後に挿入
        const hpAnimIndex = sequence.findIndex(v => v.type === 'UI_ANIMATION' && v.targetType === 'HP_BAR');
        if (hpAnimIndex !== -1) {
            sequence.splice(hpAnimIndex + 1, 0, ...defeatTasks);
        } else {
            const dialogIndex = sequence.map(v => v.type).lastIndexOf('DIALOG');
            const insertIndex = dialogIndex !== -1 ? dialogIndex + 1 : sequence.length;
            sequence.splice(insertIndex, 0, ...defeatTasks);
        }
    }
}