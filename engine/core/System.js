/**
 * @file システム基底クラス
 * @description 全てのシステムの親クラス。共通のユーティリティを提供します。
 * (旧 BaseSystem.js)
 */
export class System {
    constructor(world) {
        this.world = world;
    }

    /**
     * フレームごとの更新処理。
     * @param {number} deltaTime - 前フレームからの経過時間（ミリ秒）
     */
    update(deltaTime) {
        // デフォルトでは何もしない
    }

    /**
     * システムの破棄処理。
     */
    destroy() {
        // デフォルトでは何もしない
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