/**
 * @file VisualSequenceSystem.js
 * @description 戦闘結果やキャンセル情報から演出シーケンス（タスクリスト）を生成するシステム。
 * VisualSequenceRequestを処理し、VisualSequenceを付与する。
 * 旧 VisualSequenceService のロジックを継承。
 */
import { System } from '../../../../engine/core/System.js';
import { VisualSequenceRequest, VisualSequence } from '../../components/index.js';
import { MessageService } from '../../services/MessageService.js';
import { CancellationService } from '../../services/CancellationService.js';
import { GameEvents } from '../../../common/events.js';
import { PartInfo, PartKeyToInfoMap } from '../../../common/constants.js';
import { BattleLogType, ModalType, PlayerStateType } from '../../common/constants.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';
import { PlayerInfo } from '../../../components/index.js';

export class VisualSequenceSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(VisualSequenceRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, VisualSequenceRequest);
            this.world.removeComponent(entityId, VisualSequenceRequest);

            const sequence = this._generateSequence(entityId, request.context);
            this.world.addComponent(entityId, new VisualSequence(sequence));
        }
    }

    _generateSequence(actorId, context) {
        if (context.isCancelled) {
            return this._createCancelSequence(actorId, context);
        } else {
            return this._createCombatSequence(context);
        }
    }

    /**
     * キャンセル時のシーケンスを生成
     */
    _createCancelSequence(actorId, context) {
        const visualSequence = [];
        const { cancelReason } = context;
        const message = CancellationService.getCancelMessage(this.world, actorId, cancelReason);
        
        // 1. メッセージ表示
        if (message) {
            visualSequence.push({
                type: 'DIALOG',
                text: message,
                options: { modalType: ModalType.MESSAGE }
            });
        }

        // 2. クールダウン状態へ移行するイベント発行
        visualSequence.push({
            type: 'EVENT',
            eventName: GameEvents.EXECUTE_COMMANDS,
            detail: [{
                type: 'RESET_TO_COOLDOWN',
                targetId: actorId,
                options: { interrupted: true }
            }]
        });

        return visualSequence;
    }

    /**
     * 戦闘結果からの演出シーケンスを生成
     */
    _createCombatSequence(ctx) {
        const resolutionLog = this._buildResolutionLog(ctx);
        const sequence = [];
        const messageService = new MessageService(this.world);
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
                    if (log.effect.isPartBroken && log.effect.partKey === PartInfo.HEAD.key) {
                        defeatedPlayers.add(log.effect.targetId);
                    }
                    break;
                case BattleLogType.MISS:
                    sequence.push(...this._createMissTasks(log, ctx, messageService));
                    break;
            }
        }

        this._insertDefeatVisuals(sequence, defeatedPlayers);

        // システム的なイベントタスクを追加
        sequence.push({ type: 'EVENT', eventName: GameEvents.REFRESH_UI });
        sequence.push({ type: 'EVENT', eventName: GameEvents.CHECK_ACTION_CANCELLATION });

        return sequence;
    }

    // --- 以下、ヘルパーメソッド群 (VisualSequenceServiceから移植) ---

    _buildResolutionLog(ctx) {
        const log = [];
        // 修正: finalTargetId ではなく targetId (CombatResultのプロパティ名) を使用
        const { attackerId, intendedTargetId, targetId, guardianInfo, appliedEffects, isSupport, outcome } = ctx;

        const animationTargetId = intendedTargetId || targetId;
        log.push({ 
            type: BattleLogType.ANIMATION_START, 
            actorId: attackerId, 
            targetId: animationTargetId 
        });

        log.push({ 
            type: BattleLogType.DECLARATION, 
            actorId: attackerId,
            targetId: targetId, // 修正
            isSupport: isSupport 
        });

        if (guardianInfo) {
            log.push({ 
                type: BattleLogType.GUARDIAN_TRIGGER, 
                guardianInfo: guardianInfo 
            });
        }

        if (appliedEffects && appliedEffects.length > 0) {
            for (const effect of appliedEffects) {
                log.push({ 
                    type: BattleLogType.EFFECT, 
                    effect: effect 
                });
            }
        } else if (!outcome.isHit && intendedTargetId) {
            log.push({ 
                type: BattleLogType.MISS, 
                targetId: intendedTargetId 
            });
        }

        return log;
    }

    _createDeclarationTasks(log, ctx, messageService) {
        const def = VisualDefinitions.DECLARATION;
        const messageKey = def.getMessageKey({ ...ctx, targetId: log.targetId });
        
        if (!messageKey) return [];

        const attackerInfo = this.world.getComponent(log.actorId, PlayerInfo);
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

    _createGuardianTasks(log, ctx, messageService) {
        const def = VisualDefinitions.GUARDIAN_TRIGGER;
        const messageKey = def.getMessageKey();
        
        return [{
            type: 'DIALOG',
            text: messageService.format(messageKey, { guardianName: log.guardianInfo.name }),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        }];
    }

    _createEffectTasks(log, ctx, messageService) {
        const effect = log.effect;
        const def = VisualDefinitions[effect.type];
        if (!def) return [];

        const tasks = [];
        
        const prefixKey = def.getPrefixKey ? def.getPrefixKey(effect) : null;
        const messageKey = def.getMessageKey(effect);
        
        if (messageKey) {
            const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
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
                actorName: targetInfo?.name || '???'
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

        if (def.shouldShowHpBar && def.shouldShowHpBar(effect)) {
            tasks.push({
                type: 'UI_ANIMATION',
                targetType: 'HP_BAR',
                data: { appliedEffects: [effect] }
            });
        }

        return tasks;
    }

    _createMissTasks(log, ctx, messageService) {
        const def = VisualDefinitions.MISS;
        const messageKey = def.getMessageKey();
        const targetInfo = this.world.getComponent(log.targetId, PlayerInfo);

        return [{
            type: 'DIALOG',
            text: messageService.format(messageKey, { targetName: targetInfo?.name || '相手' }),
            options: { modalType: ModalType.EXECUTION_RESULT }
        }];
    }

    _insertDefeatVisuals(sequence, defeatedPlayers) {
        if (defeatedPlayers.size === 0) return;

        const defeatTasks = [];
        for (const playerId of defeatedPlayers) {
            defeatTasks.push({ type: 'APPLY_VISUAL_EFFECT', targetId: playerId, className: 'is-defeated' });
        }

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