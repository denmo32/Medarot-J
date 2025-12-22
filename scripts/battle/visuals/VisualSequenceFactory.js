/**
 * @file VisualSequenceFactory.js
 * @description 戦闘結果データから演出シーケンス（タスクリスト）を構築するファクトリ。
 * VisualSequenceSystemからロジックを分離。
 */
import { MessageFormatter } from '../utils/MessageFormatter.js';
import { ValidationLogic } from '../logic/ValidationLogic.js';
import { PartInfo } from '../../common/constants.js';
import { ModalType, EffectScope } from '../common/constants.js';
import { MessageKey } from '../../data/messageRepository.js';
import { BattleQueries } from '../queries/BattleQueries.js';
import { VisualStrategyRegistry } from './VisualStrategyRegistry.js';
import { PlayerInfo } from '../../components/index.js';

/**
 * デフォルトの演出設定（フォールバック用）
 */
const DEFAULT_VISUALS = {
    DECLARATION: {
        keys: {
            support: 'SUPPORT_DECLARATION',
            miss: 'ATTACK_MISSED',
            default: 'ATTACK_DECLARATION'
        },
        animation: { attack: 'attack', support: 'support' }
    }
};

export class VisualSequenceFactory {
    constructor(world) {
        this.world = world;
    }

    /**
     * 戦闘結果コンテキストから演出シーケンスを生成する
     * @param {number} entityId - アクターのエンティティID
     * @param {object} context - 戦闘結果コンテキスト (CombatResult.data)
     * @returns {Array<object>} タスク定義オブジェクトの配列
     */
    createSequence(entityId, context) {
        if (!context) {
            return null;
        }

        // キャンセル時のシーケンス
        if (context.isCancelled) {
            return this._createCancelSequence(entityId, context);
        }

        // 通常戦闘シーケンス
        const visualConfig = BattleQueries.getPartVisualConfig(this.world, context.attackingPartId);
        const sequenceDefs = this._createCombatSequence(context, visualConfig);

        // 状態更新タスクの追加
        if (context.stateUpdates && context.stateUpdates.length > 0) {
            sequenceDefs.push({ type: 'STATE_CONTROL', updates: context.stateUpdates });
        }

        return sequenceDefs;
    }

    _createCombatSequence(ctx, visualConfig) {
        const sequence = [];
        const defeatedPlayers = new Set();
        
        // 1. アニメーション開始
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

        // 2. 行動宣言
        sequence.push(this._createDeclarationTask(ctx, visualConfig));

        // 3. ガーディアン発動演出
        if (ctx.guardianInfo) {
            const guardianPlayerInfo = this.world.getComponent(ctx.guardianInfo.id, PlayerInfo);
            const guardianName = guardianPlayerInfo?.name || ctx.guardianInfo.name;
            sequence.push({
                type: 'DIALOG',
                text: MessageFormatter.format(MessageKey.GUARDIAN_TRIGGERED, { guardianName: guardianName }),
                options: { modalType: ModalType.ATTACK_DECLARATION }
            });
        }

        // 4. エフェクト適用演出 (Strategy利用)
        if (ctx.appliedEffects && ctx.appliedEffects.length > 0) {
            for (const effect of ctx.appliedEffects) {
                // StrategyRegistryから適切なStrategyを取得してタスク生成
                const strategy = VisualStrategyRegistry.get(effect.type);
                const effectTasks = strategy.createTasks(ctx, effect, visualConfig);
                sequence.push(...effectTasks);
                
                // 撃破判定の収集 (エフェクト結果に基づく)
                if (effect.isPartBroken && effect.partKey === PartInfo.HEAD.key) {
                    defeatedPlayers.add(effect.targetId);
                }
            }
        } else if (!ctx.outcome.isHit && ctx.intendedTargetId) {
            // 回避演出 (エフェクトが発生しなかった場合)
            sequence.push({
                type: 'DIALOG',
                text: MessageFormatter.format(MessageKey.ATTACK_EVADED, { 
                    targetName: this.world.getComponent(ctx.intendedTargetId, PlayerInfo)?.name || '相手' 
                }),
                options: { modalType: ModalType.EXECUTION_RESULT }
            });
        }

        // 5. 撃破演出 (機能停止)
        defeatedPlayers.forEach(id => {
            sequence.push({ type: 'APPLY_VISUAL_EFFECT', targetId: id, className: 'is-defeated' });
        });

        // 6. UI更新リクエスト
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

    _createCancelSequence(actorId, context) {
        const message = ValidationLogic.getCancelMessage(this.world, actorId, context.cancelReason);
        return [
            { type: 'DIALOG', text: message, options: { modalType: ModalType.MESSAGE } },
            { type: 'STATE_CONTROL', updates: [{ type: 'ResetToCooldown', targetId: actorId, options: { interrupted: true } }] }
        ];
    }
}