/**
 * @file イベント管理クラス
 * @description Pub/Subパターンの基本的なイベント通知機能を提供します。
 * Worldクラスなど、イベント駆動が必要なクラスの基底として使用します。
 */
export class EventEmitter {
    constructor() {
        // key: eventName, value: Set<Function>
        this.listeners = new Map();
    }

    /**
     * イベントリスナーを登録します。
     * @param {string} eventName - イベント名
     * @param {Function} callback - コールバック関数
     */
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(callback);
    }

    /**
     * イベントリスナーを解除します。
     * @param {string} eventName - イベント名
     * @param {Function} callback - 解除するコールバック関数
     */
    off(eventName, callback) {
        if (this.listeners.has(eventName)) {
            const callbacks = this.listeners.get(eventName);
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.listeners.delete(eventName);
            }
        }
    }

    /**
     * イベントを発行し、登録されたリスナーを実行します。
     * @param {string} eventName - イベント名
     * @param {any} detail - イベントと共に渡すデータ
     */
    emit(eventName, detail) {
        if (this.listeners.has(eventName)) {
            for (const callback of this.listeners.get(eventName)) {
                callback(detail);
            }
        }
    }

    /**
     * 全てのイベントリスナーを削除します。
     */
    clearListeners() {
        this.listeners.clear();
    }
}