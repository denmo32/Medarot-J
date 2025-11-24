/**
 * @file メッセージ生成システム
 * このシステムは、ゲーム内で発生する様々なイベントを購読し、
 * それに応じたUIメッセージを生成して表示を要求する責務を持ちます。
 * ロジックと表示（メッセージ）を完全に分離するための中心的な役割を担います。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { ModalType, PartKeyToInfoMap, EffectType, ActionCancelReason } from '../common/constants.js';
import { MessageTemplates, MessageKey } from '../data/messageRepository.js';
import { PlayerInfo } from '../core/components/index.js';

// キャンセル理由とメッセージキーのマッピングを定義
const cancelReasonToMessageKey = {
    [ActionCancelReason.PART_BROKEN]: MessageKey.CANCEL_PART_BROKEN,
    [ActionCancelReason.TARGET_LOST]: MessageKey.CANCEL_TARGET_LOST,
    [ActionCancelReason.INTERRUPTED]: MessageKey.CANCEL_INTERRUPTED,
};

export class MessageSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // メッセージ生成ロジックを効果タイプごとのマップに集約
        this.supportMessageFormatters = {
            [EffectType.HEAL]: this._formatHealMessage.bind(this),
            [EffectType.APPLY_SCAN]: this._formatScanMessage.bind(this),
            [EffectType.APPLY_GLITCH]: this._formatGlitchMessage.bind(this),
            [EffectType.APPLY_GUARD]: this._formatGuardMessage.bind(this),
        };
        
        this.world.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.world.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    /**
     * 戦闘シーケンス全体のメッセージを一度に生成し、モーダル表示を要求する
     * @param {object} detail - COMBAT_SEQUENCE_RESOLVEDイベントのペイロード
     */
    onCombatSequenceResolved(detail) {
        const { attackerId, appliedEffects, targetId } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        // --- Step 1: 宣言メッセージを生成 ---
        const declarationSequence = this._createDeclarationSequence(attackerInfo, detail);
        
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: { ...detail },
            messageSequence: declarationSequence,
            immediate: true,
        });

        // --- Step 2: 結果メッセージを生成 ---
        // ターゲットが存在する、または効果が発生している場合は結果を表示
        const shouldShowResult = targetId || (appliedEffects && appliedEffects.length > 0);

        if (shouldShowResult) {
            const resultSequence = this._createResultSequence(detail);
            
            if (resultSequence.length > 0) {
                this.world.emit(GameEvents.SHOW_MODAL, {
                    type: ModalType.EXECUTION_RESULT,
                    data: { ...detail },
                    messageSequence: resultSequence,
                    immediate: true
                });
            }
        }
    }

    /**
     * 行動宣言フェーズのメッセージシーケンスを作成します。
     * @private
     */
    _createDeclarationSequence(attackerInfo, detail) {
        const { targetId, attackingPart, isSupport, guardianInfo } = detail;
        const sequence = [];

        // メインの宣言メッセージ
        let mainMessageKey;
        const params = {
            attackerName: attackerInfo.name,
            actionType: attackingPart.action,
            attackType: attackingPart.type,
            trait: attackingPart.trait,
        };

        if (isSupport) {
            mainMessageKey = MessageKey.SUPPORT_DECLARATION;
        } else if (!targetId) {
            mainMessageKey = MessageKey.ATTACK_MISSED;
        } else {
            mainMessageKey = MessageKey.ATTACK_DECLARATION;
        }

        sequence.push({ text: this.format(mainMessageKey, params) });

        // ガード発動メッセージ
        if (guardianInfo) {
            sequence.push({
                text: this.format(MessageKey.GUARDIAN_TRIGGERED, { guardianName: guardianInfo.name })
            });
        }

        return sequence;
    }

    /**
     * 行動結果フェーズのメッセージシーケンスを作成します。
     * ガード節を使用して条件分岐を整理しています。
     * @private
     */
    _createResultSequence(detail) {
        const { targetId, isSupport, outcome, appliedEffects, guardianInfo } = detail;
        
        // 1. 支援行動（非回復）の場合
        const isHealAction = appliedEffects && appliedEffects.some(e => e.type === EffectType.HEAL);
        if (isSupport && !isHealAction) {
            const supportMessage = this.generateSupportResultMessage(appliedEffects[0]);
            return [{ text: supportMessage }];
        }

        // 2. 攻撃が回避された場合
        if (!outcome.isHit && targetId) {
            const targetName = this.world.getComponent(targetId, PlayerInfo)?.name || '相手';
            return [{ 
                text: this.format(MessageKey.ATTACK_EVADED, { targetName }) 
            }];
        }

        // 3. ダメージまたは回復効果が発生した場合
        if (appliedEffects && appliedEffects.length > 0) {
            return this.generateDamageResultSequence(appliedEffects, guardianInfo);
        }

        // 4. それ以外（効果なし等）
        return [];
    }

    /**
     * 行動がキャンセルされた時のメッセージを生成します。
     * @param {object} detail - ACTION_CANCELLEDイベントのペイロード
     */
    onActionCancelled(detail) {
        const { entityId, reason } = detail;
        const actorInfo = this.world.getComponent(entityId, PlayerInfo);
        if (!actorInfo) return;

        const messageKey = cancelReasonToMessageKey[reason];
        if (!messageKey) return;
        
        const message = this.format(messageKey, { actorName: actorInfo.name });
        
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }

    /**
     * ガードパーツが破壊された時のメッセージを生成します。
     * @param {object} detail - GUARD_BROKENイベントのペイロード
     */
    onGuardBroken(detail) {
        const message = this.format(MessageKey.GUARD_BROKEN);
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }
    
    // --- ヘルパーメソッド ---

    /**
     * 複数のダメージ/回復効果を元に、連結されたメッセージを生成します。
     * @private
     */
    generateDamageResultMessage(effects, guardianInfo) {
        if (!effects || effects.length === 0) return '';
        
        const messages = [];
        const firstEffect = effects[0];
    
        if (firstEffect.type === EffectType.HEAL) {
            messages.push(this._formatHealMessage(firstEffect));
        } else {
            // 通常ダメージ処理
            this._appendDamageMessages(messages, effects, guardianInfo);
        }
    
        return messages.join('<br>');
    }

    /**
     * ダメージ関連のメッセージをリストに追加します。
     * @private
     */
    _appendDamageMessages(messages, effects, guardianInfo) {
        const firstEffect = effects[0];
        
        // 最初のヒット（メインダメージ）
        let prefix = firstEffect.isCritical ? this.format(MessageKey.CRITICAL_HIT) : '';
        const targetInfo = this.world.getComponent(firstEffect.targetId, PlayerInfo);
        const partName = PartKeyToInfoMap[firstEffect.partKey]?.name || '不明部位';
        
        const params = {
            targetName: targetInfo?.name || '不明',
            guardianName: guardianInfo?.name || '不明',
            partName: partName,
            damage: firstEffect.value,
        };

        if (guardianInfo) {
            messages.push(prefix + this.format(MessageKey.GUARDIAN_DAMAGE, params));
        } else if (firstEffect.isDefended) {
            messages.push(prefix + this.format(MessageKey.DEFENSE_SUCCESS, params));
        } else {
            messages.push(prefix + this.format(MessageKey.DAMAGE_APPLIED, params));
        }

        // 貫通ダメージ（2つ目以降の効果）
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
    }

    /**
     * ダメージ/回復効果を元に、アニメーション待機を含むメッセージシーケンスを生成します。
     * @private
     */
    generateDamageResultSequence(effects, guardianInfo) {
        const sequence = [];
        if (!effects || effects.length === 0) return [];
        
        const messageLines = this.generateDamageResultMessage(effects, guardianInfo).split('<br>');
        const hasHpChange = effects.some(e => (e.type === EffectType.DAMAGE || e.type === EffectType.HEAL) && e.value > 0);

        if (messageLines.length > 0 && messageLines[0] !== '') {
            sequence.push({ text: messageLines[0] });

            if (hasHpChange) {
                // HPバーアニメーション完了を待つステップを追加
                sequence.push({ waitForAnimation: GameEvents.HP_BAR_ANIMATION_COMPLETED });
            }

            for (let i = 1; i < messageLines.length; i++) {
                sequence.push({ text: messageLines[i] });
            }
        }
        
        return sequence;
    }

    /**
     * 支援行動の結果メッセージを生成します。
     * @private
     */
    generateSupportResultMessage(effect) {
        if (!effect) return '支援行動成功！';
        const formatter = this.supportMessageFormatters[effect.type];
        return formatter ? formatter(effect) : '支援行動成功！';
    }

    _formatHealMessage(effect) {
        if (effect.value > 0) {
            const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
            const partName = PartKeyToInfoMap[effect.partKey]?.name || '不明部位';
            return this.format(MessageKey.HEAL_SUCCESS, { 
                targetName: targetInfo.name, 
                partName: partName, 
                healAmount: effect.value 
            });
        }
        return this.format(MessageKey.HEAL_FAILED);
    }

    _formatScanMessage(effect) {
        return this.format(MessageKey.SUPPORT_SCAN_SUCCESS, { 
            scanBonus: effect.value, 
            duration: effect.duration 
        });
    }

    _formatGlitchMessage(effect) {
        const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
        return effect.wasSuccessful
            ? this.format(MessageKey.INTERRUPT_GLITCH_SUCCESS, { targetName: targetInfo.name })
            : this.format(MessageKey.INTERRUPT_GLITCH_FAILED);
    }

    _formatGuardMessage(effect) {
        return this.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
    }

    /**
     * メッセージテンプレートをデータでフォーマットします。
     */
    format(key, data = {}) {
        let template = MessageTemplates[key] || '';
        for (const placeholder in data) {
            template = template.replace(new RegExp(`{${placeholder}}`, 'g'), data[placeholder]);
        }
        return template;
    }
}