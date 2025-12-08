/**
 * @file MessageService.js
 * @description メッセージフォーマットのサービス。
 * 各EffectDefinitionから呼び出されるヘルパーメソッドを提供する。
 * 元 scripts/battle/utils/MessageGenerator.js
 */

import { MessageTemplates, MessageKey } from '../../data/messageRepository.js';
import { PlayerInfo } from '../../components/index.js';

export class MessageService {
    constructor(world) {
        this.world = world;
    }

    /**
     * 攻撃宣言時のメッセージシーケンスを生成します。
     * (これは汎用的なのでここに残す)
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
     * 回避時のメッセージシーケンスを生成します。
     * (Effectが発生しないケース用)
     */
    createResultSequence(detail) {
        const { targetId, outcome } = detail;
        
        if (!outcome.isHit && targetId) {
            const targetName = this.world.getComponent(targetId, PlayerInfo)?.name || '相手';
            return [{ 
                text: this.format(MessageKey.ATTACK_EVADED, { targetName }) 
            }];
        }
        return [];
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