/**
 * @file MessageGenerator.js
 * @description 戦闘ログやモーダルで使用するメッセージテキストを生成するユーティリティクラス。
 * MessageSystemからロジックを分離し、純粋な文字列生成を担当します。
 */

import { PartKeyToInfoMap, EffectType } from '../../common/constants.js';
import { MessageTemplates, MessageKey } from '../../data/messageRepository.js';
import { PlayerInfo } from '../../components/index.js';

export class MessageGenerator {
    constructor(world) {
        this.world = world;
        
        this.supportMessageFormatters = {
            [EffectType.HEAL]: (effect) => this._formatHealMessage(effect),
            [EffectType.APPLY_SCAN]: (effect) => this._formatScanMessage(effect),
            [EffectType.APPLY_GLITCH]: (effect) => this._formatGlitchMessage(effect),
            [EffectType.APPLY_GUARD]: (effect) => this._formatGuardMessage(effect),
        };
    }

    /**
     * 攻撃宣言時のメッセージシーケンスを生成します。
     * @param {object} detail - 戦闘結果詳細
     * @returns {Array} メッセージオブジェクトの配列
     */
    createDeclarationSequence(detail) {
        const { attackerId, targetId, attackingPart, isSupport, guardianInfo } = detail;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        
        if (!attackerInfo) return [];

        const sequence = [];

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

        if (guardianInfo) {
            sequence.push({
                text: this.format(MessageKey.GUARDIAN_TRIGGERED, { guardianName: guardianInfo.name })
            });
        }

        return sequence;
    }

    /**
     * 攻撃結果時のメッセージシーケンスを生成します。
     * @param {object} detail - 戦闘結果詳細
     * @returns {Array} メッセージオブジェクトの配列
     */
    createResultSequence(detail) {
        const { targetId, isSupport, outcome, appliedEffects, guardianInfo } = detail;
        
        const isHealAction = appliedEffects && appliedEffects.some(e => e.type === EffectType.HEAL);
        if (isSupport && !isHealAction) {
            const supportMessage = this.generateSupportResultMessage(appliedEffects?.[0]);
            return [{ text: supportMessage }];
        }

        if (!outcome.isHit && targetId) {
            const targetName = this.world.getComponent(targetId, PlayerInfo)?.name || '相手';
            return [{ 
                text: this.format(MessageKey.ATTACK_EVADED, { targetName }) 
            }];
        }

        if (appliedEffects && appliedEffects.length > 0) {
            return this.generateDamageResultSequence(appliedEffects, guardianInfo);
        }

        return [];
    }

    /**
     * サポート行動の結果メッセージを生成します。
     * @param {object} effect 
     * @returns {string}
     */
    generateSupportResultMessage(effect) {
        if (!effect) return '支援行動成功！';
        const formatter = this.supportMessageFormatters[effect.type];
        return formatter ? formatter(effect) : '支援行動成功！';
    }

    /**
     * ダメージ結果のメッセージシーケンス（HPバーアニメーション待機含む）を生成します。
     * @param {Array} effects 
     * @param {object} guardianInfo 
     * @returns {Array}
     */
    generateDamageResultSequence(effects, guardianInfo) {
        if (!effects || effects.length === 0) return [];
        
        const messageLines = this._generateDamageResultMessageLines(effects, guardianInfo);
        const hasHpChange = effects.some(e => (e.type === EffectType.DAMAGE || e.type === EffectType.HEAL) && e.value > 0);
        const sequence = [];

        if (messageLines.length > 0) {
            sequence.push({ text: messageLines[0] });

            if (hasHpChange) {
                // アニメーション完了を待つマーカー
                sequence.push({ waitForAnimation: true, effects });
            }

            for (let i = 1; i < messageLines.length; i++) {
                sequence.push({ text: messageLines[i] });
            }
        }
        
        return sequence;
    }

    /**
     * ダメージ関連メッセージを改行区切りの配列として生成します。
     * @param {Array} effects 
     * @param {object} guardianInfo 
     * @returns {string[]}
     */
    _generateDamageResultMessageLines(effects, guardianInfo) {
        if (!effects || effects.length === 0) return [];
        
        const messages = [];
        const firstEffect = effects[0];
    
        if (firstEffect.type === EffectType.HEAL) {
            messages.push(this._formatHealMessage(firstEffect));
        } else {
            this._appendDamageMessages(messages, effects, guardianInfo);
        }
    
        return messages;
    }

    _appendDamageMessages(messages, effects, guardianInfo) {
        const firstEffect = effects[0];
        
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
     * メッセージテンプレートに変数を埋め込みます。
     * @param {string} key - メッセージキー
     * @param {object} data - 置換データ
     * @returns {string}
     */
    format(key, data = {}) {
        let template = MessageTemplates[key] || '';
        for (const placeholder in data) {
            template = template.replace(new RegExp(`{${placeholder}}`, 'g'), data[placeholder]);
        }
        return template;
    }
}