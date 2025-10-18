/**
 * @file メッセージ生成システム
 * このシステムは、ゲーム内で発生する様々なイベントを購読し、
 * それに応じたUIメッセージを生成して表示を要求する責務を持ちます。
 * ロジックと表示（メッセージ）を完全に分離するための中心的な役割を担います。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { ModalType, PartKeyToInfoMap, EffectType } from '../common/constants.js';
import { MessageTemplates, MessageKey } from '../data/messageRepository.js';
import { PlayerInfo, Parts } from '../core/components/index.js';

export class MessageSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // メッセージ生成のトリガーとなるイベントを購読
        this.world.on(GameEvents.ACTION_DECLARED, this.onActionDeclared.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
    }

    /**
     * 行動が宣言された時に、攻撃宣言モーダルのメッセージを生成します。
     * @param {object} detail - ACTION_DECLAREDイベントのペイロード
     */
    onActionDeclared(detail) {
        const { attackerId, targetId, attackingPart, isSupport, guardianInfo } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        let message, guardMessage = null;

        // メッセージテンプレートを選択
        if (isSupport) {
            message = this.format(MessageKey.SUPPORT_DECLARATION, {
                attackerName: attackerInfo.name,
                actionType: attackingPart.action,
                trait: attackingPart.trait,
            });
        } else if (!targetId) {
            message = this.format(MessageKey.ATTACK_MISSED, {
                attackerName: attackerInfo.name,
            });
        } else {
            message = this.format(MessageKey.ATTACK_DECLARATION, {
                attackerName: attackerInfo.name,
                attackType: attackingPart.type,
                trait: attackingPart.trait,
            });
        }

        // ガード役がいる場合、ガードメッセージも生成
        if (guardianInfo) {
            guardMessage = this.format(MessageKey.GUARDIAN_TRIGGERED, {
                guardianName: guardianInfo.name,
            });
        }

        // ActionPanelSystemにモーダル表示を要求
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: {
                ...detail, // 元のイベントデータを引き継ぐ
                message,
                guardMessage,
            },
            immediate: true,
        });
    }

    /**
     * 行動が実行された後に、結果表示モーダルのメッセージを生成します。
     * @param {object} detail - ACTION_EXECUTEDイベントのペイロード
     */
    onActionExecuted(detail) {
        const { appliedEffects, isEvaded, isSupport, attackerId, guardianInfo } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        let finalMessage = '';

        if (isSupport) {
            finalMessage = this.generateSupportResultMessage(appliedEffects[0]);
        } else if (isEvaded) {
            const targetId = this.world.getComponent(attackerId, Parts)?.targetId;
            const targetName = targetId ? this.world.getComponent(targetId, PlayerInfo)?.name : '相手';
            finalMessage = this.format(MessageKey.ATTACK_EVADED, { targetName });
        } else if (appliedEffects && appliedEffects.length > 0) {
            finalMessage = this.generateDamageResultMessage(appliedEffects, guardianInfo);
        } else {
            finalMessage = this.format(MessageKey.ATTACK_MISSED, { attackerName: attackerInfo.name });
        }
        
        // ActionPanelSystemにモーダル表示を要求
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.EXECUTION_RESULT,
            data: {
                ...detail, // 元のイベントデータを引き継ぐ
                message: finalMessage,
            },
            immediate: true
        });
    }

    /**
     * 行動がキャンセルされた時のメッセージを生成します。
     * @param {object} detail - ACTION_CANCELLEDイベントのペイロード
     */
    onActionCancelled(detail) {
        const { entityId, reason } = detail;
        const actorInfo = this.world.getComponent(entityId, PlayerInfo);
        if (!actorInfo) return;

        let messageKey;
        if (reason === 'PART_BROKEN') {
            messageKey = MessageKey.CANCEL_PART_BROKEN;
        } else if (reason === 'TARGET_LOST') {
            messageKey = MessageKey.CANCEL_TARGET_LOST;
        } else {
            return; // 不明な理由の場合は何もしない
        }
        
        const message = this.format(messageKey, { actorName: actorInfo.name });
        
        // 汎用メッセージモーダルで表示
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message }
        });
    }
    
    // --- ヘルパーメソッド ---

    /**
     * 複数のダメージ効果（貫通含む）を元に、連結されたメッセージを生成します。
     * @private
     */
    generateDamageResultMessage(effects, guardianInfo) {
        let messages = [];
        const firstEffect = effects[0];

        // 最初のダメージメッセージ
        let prefix = firstEffect.isCritical ? this.format(MessageKey.CRITICAL_HIT) : '';
        const targetInfo = this.world.getComponent(firstEffect.targetId, PlayerInfo);
        const partName = PartKeyToInfoMap[firstEffect.partKey]?.name || '不明部位';

        if (guardianInfo) {
            messages.push(prefix + this.format(MessageKey.GUARDIAN_DAMAGE, {
                guardianName: guardianInfo.name,
                partName: partName,
                damage: firstEffect.value,
            }));
        } else if (firstEffect.isDefended) {
            messages.push(prefix + this.format(MessageKey.DEFENSE_SUCCESS, {
                targetName: targetInfo.name,
                partName: partName,
                damage: firstEffect.value,
            }));
        } else {
            messages.push(prefix + this.format(MessageKey.DAMAGE_APPLIED, {
                targetName: targetInfo.name,
                partName: partName,
                damage: firstEffect.value,
            }));
        }

        // 2つ目以降の効果（貫通など）のメッセージを追加
        for (let i = 1; i < effects.length; i++) {
            const effect = effects[i];
            if (effect.isPenetration) {
                const penetratedPartName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
                messages.push(this.format(MessageKey.PENETRATION_DAMAGE, {
                    partName: penetratedPartName,
                    damage: effect.value,
                }));
            }
        }
        return messages.join('<br>'); // HTMLの改行タグで連結
    }

    /**
     * 支援行動の結果メッセージを生成します。
     * @private
     */
    generateSupportResultMessage(effect) {
        if (!effect) return '支援行動成功！';
        
        const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
        const partInfo = this.world.getComponent(effect.targetId, Parts)?.[effect.partKey];

        switch(effect.type) {
            case EffectType.HEAL:
                return effect.value > 0
                    ? this.format(MessageKey.HEAL_SUCCESS, { targetName: targetInfo.name, partName: PartKeyToInfoMap[effect.partKey].name, healAmount: effect.value })
                    : this.format(MessageKey.HEAL_FAILED);
            case EffectType.APPLY_SCAN:
                return this.format(MessageKey.SUPPORT_SCAN_SUCCESS, { scanBonus: effect.value, duration: effect.duration });
            case EffectType.APPLY_GLITCH:
                return effect.wasSuccessful
                    ? this.format(MessageKey.INTERRUPT_GLITCH_SUCCESS, { targetName: targetInfo.name })
                    : this.format(MessageKey.INTERRUPT_GLITCH_FAILED);
            case EffectType.APPLY_GUARD:
                return this.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
            default:
                return '支援行動成功！';
        }
    }

    /**
     * メッセージテンプレートをデータでフォーマットします。
     * @param {string} key - MessageTemplatesのキー
     * @param {object} data - プレースホルダーを置き換えるデータ
     * @returns {string} フォーマット済みのメッセージ
     */
    format(key, data = {}) {
        let template = MessageTemplates[key] || '';
        for (const placeholder in data) {
            template = template.replace(new RegExp(`{${placeholder}}`, 'g'), data[placeholder]);
        }
        return template;
    }

    update(deltaTime) {}
}