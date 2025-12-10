/**
 * @file ECS (Entity-Component-System) の中核クラス
 * @description エンティティ、コンポーネント、システムの管理とオーケストレーションを行います。
 * Queryシステム導入によるパフォーマンス最適化版。Mapによるクエリキャッシュに対応。
 */
import { EventEmitter } from '../event/EventEmitter.js';
import { Query } from './Query.js';

export class World extends EventEmitter {
    constructor() {
        super();

        // key: entityId, value: Set<ComponentClass>
        this.entities = new Map();
        this.nextEntityId = 0;

        // key: ComponentClass, value: Map<entityId, componentInstance>
        this.components = new Map();

        // --- System Storage ---
        this.systems = [];

        // --- Query Storage ---
        // key: querySignature (string), value: Query
        this.queries = new Map();
    }

    // === Entity and Component Methods ===

    createEntity() {
        const entityId = this.nextEntityId++;
        this.entities.set(entityId, new Set());
        return entityId;
    }

    addComponent(entityId, component) {
        const componentClass = component.constructor;
        const entityComponents = this.entities.get(entityId);
        
        if (!entityComponents) {
            console.error(`Attempted to add component to non-existent entity ${entityId}`);
            return;
        }

        // 既に持っている場合は上書きだが、構成変更ではないのでクエリ更新は不要かも？
        // ただしインスタンスが変わるため、念のため更新する。
        const isNew = !entityComponents.has(componentClass);
        entityComponents.add(componentClass);

        if (!this.components.has(componentClass)) {
            this.components.set(componentClass, new Map());
        }
        this.components.get(componentClass).set(entityId, component);

        // クエリの更新
        this._updateQueries(entityId);
    }

    getComponent(entityId, componentClass) {
        return this.components.get(componentClass)?.get(entityId);
    }

    removeComponent(entityId, componentClass) {
        const entityComponents = this.entities.get(entityId);
        if (entityComponents && entityComponents.has(componentClass)) {
            entityComponents.delete(componentClass);
            
            if (this.components.has(componentClass)) {
                this.components.get(componentClass).delete(entityId);
            }
            
            // クエリの更新
            this._updateQueries(entityId);
        }
    }

    getSingletonComponent(componentClass) {
        const componentMap = this.components.get(componentClass);
        if (!componentMap || componentMap.size === 0) {
            return null;
        }
        return componentMap.values().next().value;
    }

    /**
     * コンポーネントの組み合わせを指定してエンティティを取得します。
     * O(1) でキャッシュされたクエリを取得します。
     * @param  {...Function} componentClasses
     * @returns {number[]}
     */
    getEntitiesWith(...componentClasses) {
        // クエリ署名の生成 (クラス名をソートして結合)
        // ※クラス名が衝突する可能性は低い前提。厳密にはSymbolやUnique IDを使うべきだが、
        //   JSのクラスオブジェクト自体をMapのキーにするのは組み合わせだと難しい。
        //   ここではクラス名のソート済み文字列をキーとする。
        const signature = componentClasses
            .map(c => c.name)
            .sort()
            .join('|');

        let query = this.queries.get(signature);

        // なければ作成
        if (!query) {
            query = new Query(this, componentClasses);
            this.queries.set(signature, query);
        }

        return query.getEntities();
    }

    destroyEntity(entityId) {
        const componentClasses = this.entities.get(entityId);
        if (componentClasses) {
            for (const componentClass of componentClasses) {
                this.components.get(componentClass)?.delete(entityId);
            }
        }
        this.entities.delete(entityId);

        // クエリから削除
        for (const query of this.queries.values()) {
            query.onEntityRemoved(entityId);
        }
    }

    _updateQueries(entityId) {
        for (const query of this.queries.values()) {
            query.onEntityUpdated(entityId);
        }
    }

    // === System Methods ===

    registerSystem(system) {
        this.systems.push(system);
    }

    update(deltaTime) {
        for (const system of this.systems) {
            if (system.execute) {
                system.execute(deltaTime);
            } else if (system.update) {
                system.update(deltaTime);
            }
        }
    }

    reset() {
        for (const system of this.systems) {
            if (system.destroy) {
                system.destroy();
            }
        }
        
        this.clearListeners();
        this.systems = [];
        this.entities.clear();
        this.components.clear();
        this.queries.clear();
        this.nextEntityId = 0;
    }
}