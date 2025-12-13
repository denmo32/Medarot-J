/**
 * @file MessageService.js
 * @description メッセージフォーマットのサービス。
 * メッセージテンプレートの置換機能を提供する。
 * 以前の演出生成ロジックはVisualSequenceServiceへ移行されたため、純粋なフォーマッターとして機能する。
 */

import { MessageTemplates } from '../../data/messageRepository.js';

export class MessageService {
    constructor(world) {
        this.world = world;
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