/**
 * すべてのシステムクラスの基底クラス
 * 共通の初期化処理とユーティリティを提供
 * [リファクタリング] GameContextの分割後、各システムはBattleContextなどの
 * 専門的なコンテキストをコンストラクタで直接取得するようになりました。
 * この基底クラスは汎用的なWorldへの参照のみを提供します。
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