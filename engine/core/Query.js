/**
 * @file ECSクエリクラス
 * @description 特定のコンポーネントの組み合わせを持つエンティティのセットを常に最新の状態に保ちます。
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
        if (this.matches(entityId)) {
            this.entities.add(entityId);
        } else {
            this.entities.delete(entityId);
        }
    }

    /**
     * エンティティ削除時にWorldから呼び出される
     * @param {number} entityId 
     */
    onEntityRemoved(entityId) {
        this.entities.delete(entityId);
    }

    /**
     * 条件を満たすエンティティのリストを取得
     * @returns {number[]}
     */
    getEntities() {
        return Array.from(this.entities);
    }
}