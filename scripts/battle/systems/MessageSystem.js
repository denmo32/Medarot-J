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
        // メッセージ生成ロジックを効果タイプごとのマップに集約
        this.supportMessageFormatters = {
            [EffectType.HEAL]: this._formatHealMessage.bind(this),
            [EffectType.APPLY_SCAN]: this._formatScanMessage.bind(this),
            [EffectType.APPLY_GLITCH]: this._formatGlitchMessage.bind(this),
            [EffectType.APPLY_GUARD]: this._formatGuardMessage.bind(this),
        };
        
        // 複数のイベントの代わりに、統合されたCOMBAT_SEQUENCE_RESOLVEDイベントを購読する
        this.world.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.world.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.world.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    /**
     * 戦闘シーケンス全体のメッセージを一度に生成し、モーダル表示を要求する
     * @param {object} detail - COMBAT_SEQUENCE_RESOLVEDイベントのペイロード
     */
    onCombatSequenceResolved(detail) {
        const { attackerId, targetId, attackingPart, isSupport, guardianInfo, outcome, appliedEffects } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        let messageSequence = [];
        let modalType;

        // --- Step 1: 宣言メッセージを生成 ---
        let mainMessageText;
        if (isSupport) {
            mainMessageText = this.format(MessageKey.SUPPORT_DECLARATION, {
                attackerName: attackerInfo.name,
                actionType: attackingPart.action,
                trait: attackingPart.trait,
            });
        } else if (!targetId) {
            mainMessageText = this.format(MessageKey.ATTACK_MISSED, {
                attackerName: attackerInfo.name,
            });
        } else {
            mainMessageText = this.format(MessageKey.ATTACK_DECLARATION, {
                attackerName: attackerInfo.name,
                attackType: attackingPart.type,
                trait: attackingPart.trait,
            });
        }
        messageSequence.push({ text: mainMessageText });

        // ガードメッセージをシーケンスに追加
        if (guardianInfo) {
            const guardMessageText = this.format(MessageKey.GUARDIAN_TRIGGERED, {
                guardianName: guardianInfo.name,
            });
            messageSequence.push({ text: guardMessageText });
        }
        
        // 宣言モーダル用のデータを準備し、表示要求
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: { ...detail },
            messageSequence: messageSequence,
            immediate: true,
        });


        // --- Step 2: 結果メッセージを生成 ---
        let resultSequence = [];
        const isHealAction = appliedEffects && appliedEffects.some(e => e.type === EffectType.HEAL);

        if (isSupport && !isHealAction) {
            const supportMessage = this.generateSupportResultMessage(appliedEffects[0]);
            resultSequence.push({ text: supportMessage });
        } else if (!outcome.isHit && targetId) { // ターゲットがいる攻撃の回避
            const targetName = this.world.getComponent(targetId, PlayerInfo)?.name || '相手';
            const evadedMessage = this.format(MessageKey.ATTACK_EVADED, { targetName });
            resultSequence.push({ text: evadedMessage });
        } else if (appliedEffects && appliedEffects.length > 0) {
            resultSequence = this.generateDamageResultSequence(appliedEffects, guardianInfo);
        } else {
            // ここに来るのは、ターゲットが元々いない攻撃(空振り)か、効果が何もなかった場合
            // 宣言メッセージで「空を切った」と表示済みなので、結果は不要
        }

        // 結果メッセージが存在する場合のみ、結果表示モーダルを要求
        if(resultSequence.length > 0) {
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: ModalType.EXECUTION_RESULT,
                data: { ...detail },
                messageSequence: resultSequence,
                immediate: true
            });
        }
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
        
        // 汎用メッセージモーダルで表示（これは単一メッセージなのでシーケンスは不要）
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
        const { entityId } = detail;
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
        let messages = [];
        if (!effects || effects.length === 0) return '';
    
        const firstEffect = effects[0];
    
        if (firstEffect.type === EffectType.HEAL) {
            messages.push(this._formatHealMessage(firstEffect));
        } else { // HEAL以外はダメージ系として扱う
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
        }
    
        // 2つ目以降の貫通ダメージメッセージを生成
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
     * ダメージ/回復効果を元に、アニメーション待機を含むメッセージシーケンスを生成します。
     * @private
     */
    generateDamageResultSequence(effects, guardianInfo) {
        const sequence = [];
        if (!effects || effects.length === 0) return [];
        
        const messageLines = this.generateDamageResultMessage(effects, guardianInfo).split('<br>');

        const hasHpChange = effects.some(e => (e.type === EffectType.DAMAGE || e.type === EffectType.HEAL) && e.value > 0);

        if (messageLines.length > 0) {
            sequence.push({ text: messageLines[0] });

            if (hasHpChange) {
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

    /**
     * 回復行動の結果メッセージを生成します。
     * @param {object} effect - 回復効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
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

    /**
     * スキャン行動の結果メッセージを生成します。
     * @param {object} effect - スキャン効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
    _formatScanMessage(effect) {
        return this.format(MessageKey.SUPPORT_SCAN_SUCCESS, { 
            scanBonus: effect.value, 
            duration: effect.duration 
        });
    }

    /**
     * 妨害行動の結果メッセージを生成します。
     * @param {object} effect - 妨害効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
    _formatGlitchMessage(effect) {
        const targetInfo = this.world.getComponent(effect.targetId, PlayerInfo);
        return effect.wasSuccessful
            ? this.format(MessageKey.INTERRUPT_GLITCH_SUCCESS, { targetName: targetInfo.name })
            : this.format(MessageKey.INTERRUPT_GLITCH_FAILED);
    }

    /**
     * 防御行動の結果メッセージを生成します。
     * @param {object} effect - 防御効果オブジェクト
     * @returns {string} フォーマット済みメッセージ
     * @private
     */
    _formatGuardMessage(effect) {
        return this.format(MessageKey.DEFEND_GUARD_SUCCESS, { guardCount: effect.value });
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