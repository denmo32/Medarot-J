/**
 * @file VisualSequenceSystem.js
 * @description 演出シーケンス生成システム。
 * MessageService, CancellationService -> MessageFormatter, ValidationLogic, BattleQueries
 */
import { System } from '../../../../engine/core/System.js';
import {
    BattleSequenceState, GeneratingVisuals, ExecutingVisuals,
    VisualSequence, CombatResult, SequenceFinished
} from '../../components/index.js';
import { PlayerInfo } from '../../../components/index.js';
import { MessageFormatter } from '../../utils/MessageFormatter.js';
import { ValidationLogic } from '../../logic/ValidationLogic.js';
import { PartInfo, PartKeyToInfoMap } from '../../../common/constants.js';
import { ModalType, EffectType, EffectScope } from '../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';
import { BattleQueries } from '../../queries/BattleQueries.js';
import { EffectRegistry } from '../../definitions/EffectRegistry.js';

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
        // Fallback definitions for showHpBar if handler doesn't specify
        [EffectType.DAMAGE]: { showHpBar: true },
        [EffectType.HEAL]: { showHpBar: true },
    }
};

export class VisualSequenceSystem extends System {
    constructor(world) {
        super(world);
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

            const visualConfig = BattleQueries.getPartVisualConfig(this.world, context.attackingPartId);

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
            const guardianPlayerInfo = this.world.getComponent(ctx.guardianInfo.id, PlayerInfo);
            const guardianName = guardianPlayerInfo?.name || ctx.guardianInfo.name;
            sequence.push({
                type: 'DIALOG',
                text: MessageFormatter.format(MessageKey.GUARDIAN_TRIGGERED, { guardianName: guardianName }),
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
                text: MessageFormatter.format(MessageKey.ATTACK_EVADED, { 
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
            trait: ctx.attackingPart.trait,
        };

        return {
            type: 'DIALOG',
            text: MessageFormatter.format(MessageKey[templateId] || templateId, params),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        };
    }

    _createEffectTasks(effect, ctx, visualConfig) {
        // Handlerから演出情報を取得
        const handler = EffectRegistry.get(effect.type);
        if (!handler) return [];

        const visualResult = handler.resolveVisual(effect, visualConfig);
        if (!visualResult || !visualResult.messageKey) return [];

        const tasks = [];
        
        const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);

        const params = {
            targetName: targetInfo?.name || '不明',
            partName: PartKeyToInfoMap[effect.partKey]?.name || '不明部位',
            damage: effect.value,
            healAmount: effect.value,
            scanBonus: effect.value,
            duration: effect.duration || 0,
            guardCount: effect.value,
            actorName: targetInfo?.name || '???',
            // マージされたパラメータ (resolveVisualで追加された場合)
            ...(visualResult.params || {})
        };

        // ガーディアンコンテキストの補完
        if (ctx.guardianInfo) {
            const guardianPlayerInfo = this.world.getComponent(ctx.guardianInfo.id, PlayerInfo);
            params.guardianName = guardianPlayerInfo?.name || ctx.guardianInfo.name;
        }

        let text = MessageFormatter.format(MessageKey[visualResult.messageKey] || visualResult.messageKey, params);
        
        if (effect.type === EffectType.DAMAGE && effect.isCritical) {
            text = MessageFormatter.format(MessageKey.CRITICAL_HIT) + text;
        }

        tasks.push({
            type: 'DIALOG',
            text,
            options: { modalType: ModalType.EXECUTION_RESULT }
        });

        // HPバー演出の有無判定
        // EffectVisualConfig -> Default Fallback
        const effectVisualDef = visualConfig?.impacts?.[effect.type] || DEFAULT_VISUALS.EFFECTS[effect.type];
        const shouldShowHpBar = effectVisualDef?.showHpBar;

        if (shouldShowHpBar && effect.value > 0) {
            tasks.push({ type: 'UI_ANIMATION', targetType: 'HP_BAR', data: { appliedEffects: [effect] } });
        }

        return tasks;
    }

    _createCancelSequence(actorId, context) {
        const message = ValidationLogic.getCancelMessage(this.world, actorId, context.cancelReason);
        return [
            { type: 'DIALOG', text: message, options: { modalType: ModalType.MESSAGE } },
            { type: 'STATE_CONTROL', updates: [{ type: 'ResetToCooldown', targetId: actorId, options: { interrupted: true } }] }
        ];
    }
}