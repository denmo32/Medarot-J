/**
 * @file イベント管理クラス
 * @description Pub/Subパターンの基本的なイベント通知機能を提供します。
 * 非同期制御のためのwaitFor機能を追加。
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
     * イベントリスナーを一度だけ実行されるように登録します。
     * @param {string} eventName 
     * @param {Function} callback 
     */
    once(eventName, callback) {
        const wrapper = (detail) => {
            this.off(eventName, wrapper);
            callback(detail);
        };
        this.on(eventName, wrapper);
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
            // リスナー実行中の追加・削除に対応するためコピーして回す
            const callbacks = Array.from(this.listeners.get(eventName));
            for (const callback of callbacks) {
                callback(detail);
            }
        }
    }

    /**
     * 特定のイベントが発生するのを待ちます。
     * @param {string} eventName - 待機するイベント名
     * @param {Function} [predicate] - イベントデータを検証する関数 (trueを返すと解決)
     * @param {number} [timeout=0] - タイムアウト時間(ms)。0の場合は無制限。
     * @returns {Promise<any>} イベントデータ
     */
    waitFor(eventName, predicate = null, timeout = 0) {
        return new Promise((resolve, reject) => {
            let timer = null;
            
            const listener = (detail) => {
                if (!predicate || predicate(detail)) {
                    cleanup();
                    resolve(detail);
                }
            };

            const cleanup = () => {
                this.off(eventName, listener);
                if (timer) clearTimeout(timer);
            };

            this.on(eventName, listener);

            if (timeout > 0) {
                timer = setTimeout(() => {
                    cleanup();
                    reject(new Error(`waitFor timeout: ${eventName}`));
                }, timeout);
            }
        });
    }

    /**
     * 全てのイベントリスナーを削除します。
     */
    clearListeners() {
        this.listeners.clear();
    }
}