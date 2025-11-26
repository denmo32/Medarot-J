/**
 * @file システム基底クラス
 * @description 全てのシステムの親クラス。
 * 共通のユーティリティ、イベント管理、エラーハンドリングを提供します。
 * (旧 BaseSystem.js)
 */
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class System {
    constructor(world) {
        this.world = world;
        this._boundListeners = [];
    }

    /**
     * フレームごとの更新処理。
     * サブクラスでオーバーライドして使用します。
     * @param {number} deltaTime - 前フレームからの経過時間（ミリ秒）
     */
    update(deltaTime) {
        // デフォルトでは何もしない
    }

    /**
     * 安全に実行される更新処理ラッパー
     * Worldクラスから呼び出されます。
     * @param {number} deltaTime
     */
    execute(deltaTime) {
        try {
            this.update(deltaTime);
        } catch (error) {
            ErrorHandler.handle(error, {
                system: this.constructor.name,
                method: 'update'
            });
        }
    }

    /**
     * イベントリスナーを登録します。
     * システム破棄時に自動的に解除されるため、個別の解除処理は不要です。
     * また、ハンドラ内のエラーを自動的にキャッチします。
     * @param {string} eventName
     * @param {Function} callback
     */
    on(eventName, callback) {
        // エラーハンドリングのためのラップ
        const wrappedCallback = (...args) => {
            try {
                callback(...args);
            } catch (error) {
                ErrorHandler.handle(error, {
                    system: this.constructor.name,
                    event: eventName,
                    method: 'eventHandler'
                });
            }
        };

        this.world.on(eventName, wrappedCallback);
        this._boundListeners.push({ eventName, callback: wrappedCallback });
    }

    /**
     * システムの破棄処理。
     * 登録されたイベントリスナーを全て解除します。
     */
    destroy() {
        for (const { eventName, callback } of this._boundListeners) {
            this.world.off(eventName, callback);
        }
        this._boundListeners = [];
    }

    /**
     * 指定されたコンポーネント群を持つエンティティのリストを取得するショートカット
     * @param  {...Function} componentClasses
     * @returns {number[]}
     */
    getEntities(...componentClasses) {
        return this.world.getEntitiesWith(...componentClasses);
    }

    /**
     * 指定されたエンティティが有効かチェックするユーティリティ
     * @param {number} entityId
     * @returns {boolean}
     */
    isValidEntity(entityId) {
        return entityId !== null && entityId !== undefined;
    }

    /**
     * コンポーネントをキャッシュしながら取得するユーティリティ
     * @param {number} entityId
     * @param {Function} componentClass
     * @param {Map} cache - オプション
     * @returns {Object|null}
     */
    getCachedComponent(entityId, componentClass, cache = null) {
        if (!this.isValidEntity(entityId)) return null;

        const cacheKey = `${entityId}-${componentClass.name}`;
        if (cache && cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const component = this.world.getComponent(entityId, componentClass);
        if (cache) {
            cache.set(cacheKey, component);
        }
        return component;
    }

    /**
     * イベントを発行するユーティリティ
     * @param {string} eventName
     * @param {Object} detail
     */
    emitEvent(eventName, detail = {}) {
        this.world.emit(eventName, detail);
    }
}