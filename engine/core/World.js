/**
 * @file ECS (Entity-Component-System) の中核クラス
 * @description エンティティ、コンポーネント、システムの管理とオーケストレーションを行います。
 * Queryシステム導入によるパフォーマンス最適化版。Mapによるクエリキャッシュに対応。
 */
import { Query } from './Query.js';
import { EventManager } from '../event/EventManager.js';

export class World {
    constructor() {
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

        // --- Component ID Management (Minification Safety) ---
        // key: ComponentClass, value: number (unique ID)
        this.componentIdMap = new Map();
        this.nextComponentId = 0;

        // --- Event Manager ---
        this.eventManager = new EventManager();
    }

    // === Component ID Management ===

    /**
     * コンポーネントクラスに対する一意な内部IDを取得または発行する
     * @param {Function} componentClass 
     * @returns {number}
     */
    _getComponentId(componentClass) {
        if (!this.componentIdMap.has(componentClass)) {
            this.componentIdMap.set(componentClass, this.nextComponentId++);
        }
        return this.componentIdMap.get(componentClass);
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

    /**
     * 指定されたクラスのコンポーネントを検索し、存在すればそのインスタンスを返します。
     * 重要: この関数はコンポーネントを自動生成・登録しません。既存のコンポーネントのみを取得します。
     * @param {Function} componentClass - 取得したいコンポーネントのクラス
     * @returns {Object|null} コンポーネントのインスタンスまたはnull
     */
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
        // クエリ署名の生成
        // クラス名(c.name)ではなく、実行時に割り当てた一意なIDを使用する。
        // これによりMinificationでクラス名が変わっても、同一実行環境内での一意性が保たれる。
        const signature = componentClasses
            .map(c => this._getComponentId(c))
            .sort((a, b) => a - b) // IDで数値ソート
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

    on(eventName, callback) {
        this.eventManager.on(eventName, callback);
    }

    emit(eventName, detail) {
        this.eventManager.emit(eventName, detail);
    }

    off(eventName, callback) {
        this.eventManager.off(eventName, callback);
    }

    waitFor(eventName, predicate = null, timeout = 0) {
        return this.eventManager.waitFor(eventName, predicate, timeout);
    }

    reset() {
        for (const system of this.systems) {
            if (system.destroy) {
                system.destroy();
            }
        }

        this.eventManager.clear();
        this.systems = [];
        this.entities.clear();
        this.components.clear();
        this.queries.clear();
        this.nextEntityId = 0;
        this.componentIdMap.clear();
        this.nextComponentId = 0;
    }
}