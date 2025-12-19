/**
 * @file VisualSequenceSystem.js
 * @description 演出シーケンス生成システム。
 * 修正: メッセージテンプレート用のパラメータ（guardCount, duration等）を正しく構築するように修正。
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
import { ModalType, EffectType, EffectScope } from '../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';
import { QueryService } from '../../services/QueryService.js';

/**
 * システムのデフォルト設定（フォールバック用）
 */
const DEFAULT_VISUALS = {
    DECLARATION: {
        keys: {
            support: 'SUPPORT_DECLARATION',
            miss: 'ATTACK_MISSED',
            default: 'ATTACK_DECLARATION'
        },
        animation: { attack: 'attack', support: 'support' }
    },
    EFFECTS: {
        [EffectType.DAMAGE]: { messageKey: 'DAMAGE_APPLIED', showHpBar: true },
        [EffectType.HEAL]: { messageKey: 'HEAL_SUCCESS', showHpBar: true },
        [EffectType.APPLY_SCAN]: { messageKey: 'SUPPORT_SCAN_SUCCESS' },
        [EffectType.APPLY_GLITCH]: { messageKey: 'INTERRUPT_GLITCH_SUCCESS' },
        [EffectType.APPLY_GUARD]: { messageKey: 'DEFEND_GUARD_SUCCESS' },
        [EffectType.CONSUME_GUARD]: { messageKey: 'GUARD_EXPIRED' }
    }
};

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

            const visualConfig = QueryService.getPartVisualConfig(this.world, context.attackingPartId);

            const sequenceDefs = context.isCancelled 
                ? this._createCancelSequence(entityId, context)
                : this._createCombatSequence(context, visualConfig);

            if (context.stateUpdates && context.stateUpdates.length > 0) {
                sequenceDefs.push({ type: 'STATE_CONTROL', updates: context.stateUpdates });
            }

            this.world.addComponent(entityId, new VisualSequence(sequenceDefs));

            if (combatResult) this.world.removeComponent(entityId, CombatResult);
            this.world.removeComponent(entityId, GeneratingVisuals);
            this.world.addComponent(entityId, new ExecutingVisuals());
        }
    }

    _abortSequence(entityId) {
        this.world.removeComponent(entityId, GeneratingVisuals);
        this.world.addComponent(entityId, new SequenceFinished());
    }

    _createCombatSequence(ctx, visualConfig) {
        const sequence = [];
        const defeatedPlayers = new Set();
        
        const animType = ctx.isSupport ? 'support' : 'attack';
        const animName = visualConfig?.declaration?.animation || DEFAULT_VISUALS.DECLARATION.animation[animType];
        
        const targetScope = ctx.attackingPart.targetScope;
        const isSingleTarget = targetScope === EffectScope.ENEMY_SINGLE || targetScope === EffectScope.ALLY_SINGLE;
        const visualTargetId = isSingleTarget ? (ctx.intendedTargetId || ctx.targetId) : null;

        sequence.push({
            type: 'ANIMATE',
            animationType: animName,
            attackerId: ctx.attackerId,
            targetId: visualTargetId
        });

        sequence.push(this._createDeclarationTask(ctx, visualConfig));

        if (ctx.guardianInfo) {
            sequence.push({
                type: 'DIALOG',
                text: this.messageService.format(MessageKey.GUARDIAN_TRIGGERED, { guardianName: ctx.guardianInfo.name }),
                options: { modalType: ModalType.ATTACK_DECLARATION }
            });
        }

        if (ctx.appliedEffects && ctx.appliedEffects.length > 0) {
            for (const effect of ctx.appliedEffects) {
                const effectTasks = this._createEffectTasks(effect, ctx, visualConfig);
                sequence.push(...effectTasks);
                
                if (effect.isPartBroken && effect.partKey === PartInfo.HEAD.key) {
                    defeatedPlayers.add(effect.targetId);
                }
            }
        } else if (!ctx.outcome.isHit && ctx.intendedTargetId) {
            sequence.push({
                type: 'DIALOG',
                text: this.messageService.format(MessageKey.ATTACK_EVADED, { 
                    targetName: this.world.getComponent(ctx.intendedTargetId, PlayerInfo)?.name || '相手' 
                }),
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
        }

        defeatedPlayers.forEach(id => {
            sequence.push({ type: 'APPLY_VISUAL_EFFECT', targetId: id, className: 'is-defeated' });
        });

        sequence.push({ type: 'CREATE_REQUEST', requestType: 'RefreshUIRequest' });

        return sequence;
    }

    _createDeclarationTask(ctx, visualConfig) {
        const def = DEFAULT_VISUALS.DECLARATION;
        const templateId = visualConfig?.declaration?.templateId ||
                          (ctx.isSupport ? def.keys.support : def.keys.default);

        const attackerInfo = this.world.getComponent(ctx.attackerId, PlayerInfo);
        const params = {
            attackerName: attackerInfo?.name || '???',
            actionType: ctx.attackingPart.type,
            attackType: ctx.attackingPart.type,
            trait: ctx.attackingPart.name,
        };

        return {
            type: 'DIALOG',
            text: this.messageService.format(MessageKey[templateId] || templateId, params),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        };
    }

    _createEffectTasks(effect, ctx, visualConfig) {
        const effectVisual = visualConfig?.impacts?.[effect.type] || DEFAULT_VISUALS.EFFECTS[effect.type];
        if (!effectVisual) return [];

        if (effect.type === EffectType.CONSUME_GUARD && !effect.isExpired) return [];

        const tasks = [];
        const templateId = this._resolveEffectTemplateId(effect, ctx, effectVisual);
        
        if (templateId) {
            const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
            
            // パラメータ構築の修正: templateで使用される全てのキーを網羅
            const params = {
                targetName: targetInfo?.name || '不明',
                partName: PartKeyToInfoMap[effect.partKey]?.name || '不明部位',
                damage: effect.value,
                healAmount: effect.value,
                scanBonus: effect.value,
                duration: effect.duration || 0,
                guardCount: effect.value, // APPLY_GUARD時はvalueに回数が入っている
                actorName: targetInfo?.name || '???'
            };

            let text = this.messageService.format(MessageKey[templateId] || templateId, params);
            if (effect.isCritical) text = this.messageService.format(MessageKey.CRITICAL_HIT) + text;

            tasks.push({
                type: 'DIALOG',
                text,
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
        }

        if (effectVisual.showHpBar && effect.value > 0) {
            tasks.push({ type: 'UI_ANIMATION', targetType: 'HP_BAR', data: { appliedEffects: [effect] } });
        }

        return tasks;
    }

    _resolveEffectTemplateId(effect, ctx, effectVisual) {
        if (effect.type === EffectType.DAMAGE) {
            if (effect.isGuardBroken) return 'GUARD_BROKEN';
            if (effect.isPenetration) return 'PENETRATION_DAMAGE';
            if (effect.isDefended) return 'DEFENSE_SUCCESS';
            if (ctx.guardianInfo) return 'GUARDIAN_DAMAGE';
        } else if (effect.type === EffectType.HEAL && effect.value <= 0) {
            return 'HEAL_FAILED';
        }
        return effectVisual.messageKey || effectVisual.templateId;
    }

    _createCancelSequence(actorId, context) {
        const message = CancellationService.getCancelMessage(this.world, actorId, context.cancelReason);
        return [
            { type: 'DIALOG', text: message, options: { modalType: ModalType.MESSAGE } },
            { type: 'STATE_CONTROL', updates: [{ type: 'ResetToCooldown', targetId: actorId, options: { interrupted: true } }] }
        ];
    }
}