/**
 * @file ECSクエリクラス
 * @description 特定のコンポーネントの組み合わせを持つエンティティのセットを常に最新の状態に保ちます。
 * キャッシュ配列によるアロケーション削減版。
 */
export class Query {
    /**
     * @param {World} world 
     * @param {Function[]} componentClasses 
     */
    constructor(world, componentClasses) {
        this.world = world;
        this.componentClasses = new Set(componentClasses);
        this.entities = new Set();
        
        // 配列キャッシュ
        this._entitiesCache = null;
        this._isCacheDirty = true;
        
        // 初期化時に既存のエンティティをスキャン
        for (const [entityId] of world.entities) {
            if (this.matches(entityId)) {
                this.entities.add(entityId);
            }
        }
    }

    /**
     * 指定されたエンティティがこのクエリの条件を満たすか判定
     * @param {number} entityId 
     * @returns {boolean}
     */
    matches(entityId) {
        const entityComponents = this.world.entities.get(entityId);
        if (!entityComponents) return false;

        for (const cls of this.componentClasses) {
            if (!entityComponents.has(cls)) return false;
        }
        return true;
    }

    /**
     * エンティティの構成変更時にWorldから呼び出される
     * @param {number} entityId 
     */
    onEntityUpdated(entityId) {
        const isMatch = this.matches(entityId);
        const hasEntity = this.entities.has(entityId);

        if (isMatch && !hasEntity) {
            this.entities.add(entityId);
            this._isCacheDirty = true;
        } else if (!isMatch && hasEntity) {
            this.entities.delete(entityId);
            this._isCacheDirty = true;
        }
    }

    /**
     * エンティティ削除時にWorldから呼び出される
     * @param {number} entityId 
     */
    onEntityRemoved(entityId) {
        if (this.entities.has(entityId)) {
            this.entities.delete(entityId);
            this._isCacheDirty = true;
        }
    }

    /**
     * 条件を満たすエンティティのリストを取得
     * 参照を返すため、呼び出し元でこの配列を変更してはならない。
     * @returns {number[]}
     */
    getEntities() {
        if (this._isCacheDirty) {
            this._entitiesCache = Array.from(this.entities);
            this._isCacheDirty = false;
        }
        return this._entitiesCache;
    }
}