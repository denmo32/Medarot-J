// scripts/systems/baseSystem.js

/**
 * すべてのシステムクラスの基底クラス
 * 共通の初期化処理とユーティリティを提供
 */
export class BaseSystem {
    constructor(world) {
        this.world = world;
    }

    /**
     * 指定されたエンティティが有効かチェックするユーティリティ関数
     * @param {number} entityId - エンティティID
     * @returns {boolean} 有効な場合true
     */
    isValidEntity(entityId) {
        return entityId !== null && entityId !== undefined;
    }

    /**
     * コンポーネントをキャッシュしながら取得するユーティリティ
     * @param {number} entityId - エンティティID
     * @param {Function} componentClass - コンポーネントクラス
     * @param {Map} cache - キャッシュマップ（オプション）
     * @returns {Object|null} コンポーネントインスタンスまたはnull
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
}
