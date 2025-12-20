/**
 * @file ECSクエリクラス
 * @description 特定のコンポーネントの組み合わせを持つエンティティのセットを常に最新の状態に保ちます。
 * 最適化版: コンポーネントIDベースの高速照合を実装
 */
export class Query {
    /**
     * @param {World} world 
     * @param {Function[]} componentClasses 
     * @param {number[]} componentIds - 事前に計算されたコンポーネントID
     */
    constructor(world, componentClasses, componentIds) {
        this.world = world;
        this.componentClasses = new Set(componentClasses);
        this.componentIds = new Set(componentIds);
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
     * エンティティのコンポーネント変更時にWorldから呼び出される
     * 特定のコンポーネントIDの変更だけを効率的に処理
     * @param {number} entityId 
     * @param {number} componentId 
     * @param {boolean} isAdded 
     */
    onEntityComponentUpdated(entityId, componentId, isAdded) {
        // このクエリに関係ないコンポーネントの変更は無視
        if (!this.componentIds.has(componentId)) return;
        
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
     * 呼び出し元での破壊的変更（sort等）による汚染を防ぐため、キャッシュのシャローコピーを返す。
     * @returns {number[]}
     */
    getEntities() {
        if (this._isCacheDirty) {
            this._entitiesCache = Array.from(this.entities);
            this._isCacheDirty = false;
        }
        // キャッシュの保護: 参照ではなくコピーを返す
        return this._entitiesCache ? this._entitiesCache.slice() : [];
    }
}