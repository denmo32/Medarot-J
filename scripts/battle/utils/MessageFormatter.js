/**
 * @file MessageFormatter.js
 * @description メッセージフォーマットの純粋関数群。
 * 旧 MessageService.js
 */

import { MessageTemplates } from '../../data/messageRepository.js';

export const MessageFormatter = {
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
};