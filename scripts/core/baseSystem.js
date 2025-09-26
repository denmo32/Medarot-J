// scripts/systems/baseSystem.js

/**
 * すべてのシステムクラスの基底クラス
 * 共通の初期化処理とユーティリティを提供
 * Note: After GameContext separation, systems should retrieve their specific context components
 * (e.g., BattlePhaseContext, UIStateContext, GameModeContext, BattleHistoryContext) manually in their constructors.
 * This base class no longer provides a generic 'this.context' reference to the old GameContext.
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

    /**
     * イベントを発行するユーティリティ
     * @param {string} eventName - イベント名
     * @param {Object} detail - イベント詳細
     */
    emitEvent(eventName, detail = {}) {
        this.world.emit(eventName, detail);
    }
}
