/**
 * @file VisualSequenceSystem.js
 * @description 演出シーケンス生成システム。
 * ログタイプごとのハンドリングをメソッドに分離し、構造を整理。
 */
import { System } from '../../../../engine/core/System.js';
import {
    BattleSequenceState, GeneratingVisuals, ExecutingVisuals,
    VisualSequence, CombatResult, SequenceFinished
} from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';
import { MessageService } from '../../services/MessageService.js';
import { CancellationService } from '../../services/CancellationService.js';
import { PartInfo, PartKeyToInfoMap } from '../../../common/constants.js';
import { BattleLogType, ModalType, EffectType } from '../../common/constants.js';
import { VisualDefinitions } from '../../../data/visualDefinitions.js';
import { MessageKey } from '../../../data/messageRepository.js';

export class VisualSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.messageService = new MessageService(world);
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(BattleSequenceState, GeneratingVisuals);

        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, BattleSequenceState);
            const combatResult = this.world.getComponent(entityId, CombatResult);
            const context = state.contextData || (combatResult ? combatResult.data : null);

            if (!context) {
                this._abortSequence(entityId);
                continue;
            }

            const sequenceDefs = this._generateSequenceDefinitions(entityId, context);

            if (context.stateUpdates && context.stateUpdates.length > 0) {
                this._insertStateUpdateTasks(sequenceDefs, context.stateUpdates);
            }

            this.world.addComponent(entityId, new VisualSequence(sequenceDefs));

            if (combatResult) {
                this.world.removeComponent(entityId, CombatResult);
            }

            this.world.removeComponent(entityId, GeneratingVisuals);
            this.world.addComponent(entityId, new ExecutingVisuals());
        }
    }

    _abortSequence(entityId) {
        console.error(`VisualSequenceSystem: No context data for entity ${entityId}`);
        this.world.removeComponent(entityId, GeneratingVisuals);
        this.world.addComponent(entityId, new SequenceFinished());
    }

    _generateSequenceDefinitions(actorId, context) {
        if (context.isCancelled) {
            return this._createCancelSequence(actorId, context);
        } else {
            return this._createCombatSequence(context);
        }
    }

    _insertStateUpdateTasks(sequence, stateUpdates) {
        const updateTask = {
            type: 'STATE_CONTROL',
            updates: stateUpdates
        };
        const waitTask = {
            type: 'WAIT',
            duration: 0
        };

        // 最後のクリーンアップタスクの前に入れるのが理想的
        // ここではシーケンスの最後に近い場所に挿入
        if (sequence.length >= 2) {
             sequence.splice(sequence.length - 2, 0, updateTask, waitTask);
        } else {
             sequence.push(updateTask, waitTask);
        }
    }

    _createCancelSequence(actorId, context) {
        const visualSequence = [];
        const { cancelReason } = context;
        const message = CancellationService.getCancelMessage(this.world, actorId, cancelReason);
        
        if (message) {
            visualSequence.push({
                type: 'DIALOG',
                text: message,
                options: { modalType: ModalType.MESSAGE }
            });
        }

        visualSequence.push({
            type: 'STATE_CONTROL',
            updates: [{
                type: 'ResetToCooldown',
                targetId: actorId,
                options: { interrupted: true }
            }]
        });

        return visualSequence;
    }

    _createCombatSequence(ctx) {
        const resolutionLog = this._buildResolutionLog(ctx);
        const sequence = [];
        const defeatedPlayers = new Set();

        for (const log of resolutionLog) {
            switch (log.type) {
                case BattleLogType.ANIMATION_START:
                    sequence.push(this._createAnimationTask(log));
                    break;
                case BattleLogType.DECLARATION:
                    sequence.push(...this._createDeclarationTasks(log, ctx));
                    break;
                case BattleLogType.GUARDIAN_TRIGGER:
                    sequence.push(...this._createGuardianTasks(log, ctx));
                    break;
                case BattleLogType.EFFECT:
                    sequence.push(...this._createEffectTasks(log, ctx));
                    if (log.effect.isPartBroken && log.effect.partKey === PartInfo.HEAD.key) {
                        defeatedPlayers.add(log.effect.targetId);
                    }
                    break;
                case BattleLogType.MISS:
                    sequence.push(...this._createMissTasks(log, ctx));
                    break;
            }
        }

        this._insertDefeatVisuals(sequence, defeatedPlayers);

        // 終了処理
        sequence.push({ type: 'CREATE_REQUEST', requestType: 'RefreshUIRequest' });
        sequence.push({
            type: 'STATE_CONTROL',
            updates: [{ type: 'TransitionToCooldown', targetId: ctx.attackerId }]
        });

        return sequence;
    }

    _buildResolutionLog(ctx) {
        const log = [];
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
            targetId: targetId,
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

    _createAnimationTask(log) {
        return {
            type: 'ANIMATE',
            animationType: log.targetId ? 'attack' : 'support',
            attackerId: log.actorId,
            targetId: log.targetId
        };
    }

    _createDeclarationTasks(log, ctx) {
        const def = VisualDefinitions.EVENTS.DECLARATION;
        let messageKey;
        
        if (ctx.isSupport) messageKey = MessageKey[def.keys.support];
        else if (!ctx.targetId) messageKey = MessageKey[def.keys.miss];
        else messageKey = MessageKey[def.keys.default];
        
        if (!messageKey) return [];

        const attackerInfo = this.world.getComponent(log.actorId, PlayerInfo);
        const params = {
            attackerName: attackerInfo?.name || '???',
            actionType: ctx.attackingPart.action,
            attackType: ctx.attackingPart.action,
            trait: ctx.attackingPart.name,
        };

        return [{
            type: 'DIALOG',
            text: this.messageService.format(messageKey, params),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        }];
    }

    _createGuardianTasks(log, ctx) {
        const def = VisualDefinitions.EVENTS.GUARDIAN_TRIGGER;
        const messageKey = MessageKey[def.keys.default];
        
        return [{
            type: 'DIALOG',
            text: this.messageService.format(messageKey, { guardianName: log.guardianInfo.name }),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        }];
    }

    _createEffectTasks(log, ctx) {
        const effect = log.effect;
        const def = VisualDefinitions[effect.type];
        if (!def) return [];

        const tasks = [];
        const messageKey = this._resolveEffectMessageKey(effect, ctx, def);
        const prefixKey = this._resolveEffectPrefixKey(effect, def);
        
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

            let text = this.messageService.format(messageKey, params);
            if (prefixKey) {
                text = this.messageService.format(prefixKey) + text;
            }

            tasks.push({
                type: 'DIALOG',
                text: text,
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
        }

        if (def.showHpBar && effect.value > 0) {
            tasks.push({
                type: 'UI_ANIMATION',
                targetType: 'HP_BAR',
                data: { appliedEffects: [effect] }
            });
        }

        return tasks;
    }

    _resolveEffectMessageKey(effect, ctx, def) {
        const keys = def.keys;
        if (!keys) return null;

        // 特殊条件チェック
        if (effect.type === EffectType.DAMAGE) {
            if (effect.isGuardBroken) return MessageKey[keys.guardBroken];
            if (effect.isPenetration) return MessageKey[keys.penetration];
            if (effect.isDefended) return MessageKey[keys.defended];
            if (effect.guardianName || ctx.guardianInfo) return MessageKey[keys.guardian];
        } else if (effect.type === EffectType.HEAL) {
            return effect.value > 0 ? MessageKey[keys.success] : MessageKey[keys.failed];
        } else if (effect.type === EffectType.APPLY_GLITCH) {
            return effect.wasSuccessful ? MessageKey[keys.success] : MessageKey[keys.failed];
        } else if (effect.type === EffectType.CONSUME_GUARD) {
            return effect.isExpired ? MessageKey[keys.expired] : null;
        }

        return MessageKey[keys.default] || null;
    }

    _resolveEffectPrefixKey(effect, def) {
        if (!def.keys || !def.keys.prefixCritical) return null;
        return effect.isCritical ? MessageKey[def.keys.prefixCritical] : null;
    }

    _createMissTasks(log, ctx) {
        const def = VisualDefinitions.EVENTS.MISS;
        const messageKey = MessageKey[def.keys.default];
        const targetInfo = this.world.getComponent(log.targetId, PlayerInfo);

        return [{
            type: 'DIALOG',
            text: this.messageService.format(messageKey, { targetName: targetInfo?.name || '相手' }),
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