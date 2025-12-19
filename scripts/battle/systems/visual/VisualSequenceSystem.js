/**
 * @file VisualSequenceSystem.js
 * @description 演出シーケンス生成システム。
 * パーツEntityのPartVisualConfigコンポーネントに基づいて演出を生成します。
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
    },
    GUARDIAN: { messageKey: 'GUARDIAN_TRIGGERED' },
    MISS: { messageKey: 'ATTACK_EVADED' }
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

            // パーツ固有の演出設定を取得
            const visualConfig = QueryService.getPartVisualConfig(this.world, context.attackingPartId);

            const sequenceDefs = this._generateSequenceDefinitions(entityId, context, visualConfig);

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

    _generateSequenceDefinitions(actorId, context, visualConfig) {
        if (context.isCancelled) {
            return this._createCancelSequence(actorId, context);
        } else {
            return this._createCombatSequence(context, visualConfig);
        }
    }

    _insertStateUpdateTasks(sequence, stateUpdates) {
        const updateTask = { type: 'STATE_CONTROL', updates: stateUpdates };
        const waitTask = { type: 'WAIT', duration: 0 };

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

    _createCombatSequence(ctx, visualConfig) {
        const sequence = [];
        const defeatedPlayers = new Set();
        
        // 1. アニメーション開始
        const animType = ctx.isSupport ? 'support' : 'attack';
        const animName = visualConfig?.declaration?.animation || DEFAULT_VISUALS.DECLARATION.animation[animType];
        sequence.push({
            type: 'ANIMATE',
            animationType: animName,
            attackerId: ctx.attackerId,
            targetId: ctx.intendedTargetId || ctx.targetId
        });

        // 2. 行動宣言メッセージ
        const declarationTask = this._createDeclarationTask(ctx, visualConfig);
        if (declarationTask) sequence.push(declarationTask);

        // 3. ガード演出
        if (ctx.guardianInfo) {
            const guardianTask = this._createGuardianTask(ctx);
            if (guardianTask) sequence.push(guardianTask);
        }

        // 4. 効果適用演出
        if (ctx.appliedEffects && ctx.appliedEffects.length > 0) {
            for (const effect of ctx.appliedEffects) {
                const effectTasks = this._createEffectTasks(effect, ctx, visualConfig);
                sequence.push(...effectTasks);
                
                if (effect.isPartBroken && effect.partKey === PartInfo.HEAD.key) {
                    defeatedPlayers.add(effect.targetId);
                }
            }
        } else if (!ctx.outcome.isHit && ctx.intendedTargetId) {
            // ミス演出
            sequence.push(this._createMissTask(ctx));
        }

        this._insertDefeatVisuals(sequence, defeatedPlayers);

        // 5. 終了処理
        sequence.push({ type: 'CREATE_REQUEST', requestType: 'RefreshUIRequest' });
        sequence.push({
            type: 'STATE_CONTROL',
            updates: [{ type: 'TransitionToCooldown', targetId: ctx.attackerId }]
        });

        return sequence;
    }

    _createDeclarationTask(ctx, visualConfig) {
        const def = DEFAULT_VISUALS.DECLARATION;
        let messageKey = visualConfig?.declaration?.messageKey;

        if (!messageKey) {
            if (ctx.isSupport) messageKey = def.keys.support;
            else if (!ctx.targetId) messageKey = def.keys.miss;
            else messageKey = def.keys.default;
        }
        
        const attackerInfo = this.world.getComponent(ctx.attackerId, PlayerInfo);
        const params = {
            attackerName: attackerInfo?.name || '???',
            actionType: ctx.attackingPart.action,
            attackType: ctx.attackingPart.action,
            trait: ctx.attackingPart.name,
        };

        return {
            type: 'DIALOG',
            text: this.messageService.format(MessageKey[messageKey], params),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        };
    }

    _createGuardianTask(ctx) {
        const messageKey = DEFAULT_VISUALS.GUARDIAN.messageKey;
        return {
            type: 'DIALOG',
            text: this.messageService.format(MessageKey[messageKey], { guardianName: ctx.guardianInfo.name }),
            options: { modalType: ModalType.ATTACK_DECLARATION }
        };
    }

    _createEffectTasks(effect, ctx, visualConfig) {
        const effectVisual = visualConfig?.effects?.[effect.type] || DEFAULT_VISUALS.EFFECTS[effect.type];
        if (!effectVisual) return [];

        const tasks = [];
        const messageKey = this._resolveEffectMessageKey(effect, ctx, effectVisual);
        
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
            if (effect.isCritical) {
                text = this.messageService.format(MessageKey.CRITICAL_HIT) + text;
            }

            tasks.push({
                type: 'DIALOG',
                text: text,
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
        }

        if (effectVisual.showHpBar && effect.value > 0) {
            tasks.push({
                type: 'UI_ANIMATION',
                targetType: 'HP_BAR',
                data: { appliedEffects: [effect] }
            });
        }

        return tasks;
    }

    _resolveEffectMessageKey(effect, ctx, effectVisual) {
        // 特殊条件の優先解決
        if (effect.type === EffectType.DAMAGE) {
            if (effect.isGuardBroken) return MessageKey.GUARD_BROKEN;
            if (effect.isPenetration) return MessageKey.PENETRATION_DAMAGE;
            if (effect.isDefended) return MessageKey.DEFENSE_SUCCESS;
            if (effect.guardianName || ctx.guardianInfo) return MessageKey.GUARDIAN_DAMAGE;
        } else if (effect.type === EffectType.HEAL) {
            if (effect.value <= 0) return MessageKey.HEAL_FAILED;
        } else if (effect.type === EffectType.APPLY_GLITCH) {
            if (!effect.wasSuccessful) return MessageKey.INTERRUPT_GLITCH_FAILED;
        }

        return MessageKey[effectVisual.messageKey] || null;
    }

    _createMissTask(ctx) {
        const messageKey = DEFAULT_VISUALS.MISS.messageKey;
        const targetInfo = this.world.getComponent(ctx.intendedTargetId, PlayerInfo);

        return {
            type: 'DIALOG',
            text: this.messageService.format(MessageKey[messageKey], { targetName: targetInfo?.name || '相手' }),
            options: { modalType: ModalType.EXECUTION_RESULT }
        };
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