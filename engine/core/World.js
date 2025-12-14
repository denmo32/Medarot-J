/**
 * @file ECS (Entity-Component-System) の中核クラス
 * @description エンティティ、コンポーネント、システムの管理とオーケストレーションを行います。
 * 最適化版: コンポーネントIDの事前割り当てと高速クエリシステムを実装
 */
import { Query } from './Query.js';
import { EventManager } from '../event/EventManager.js';

export class World {
    constructor() {
        // key: entityId, value: Set<ComponentClass>
        this.entities = new Map();
        this.nextEntityId = 0;
        
        // key: ComponentClass, value: Map<entityId, componentInstance>
        // this.components = new Map(); // このプロパティは使用されていないため削除
        
        // key: componentId (number), value: ComponentClass
        this.componentClasses = new Map();
        
        // --- System Storage ---
        this.systems = [];
        
        // --- Query Storage ---
        // key: componentIdSignature (string), value: Query
        this.queries = new Map();
        
        // --- Component ID Management (Minification Safety) ---
        // key: ComponentClass, value: number (unique ID)
        this.componentIdMap = new Map();
        this.nextComponentId = 0;
        
        // --- 高速アクセス用マッピング ---
        // key: componentId, value: { entities: Set<number>, components: Map<number, any> }
        this.componentRegistry = new Map();
        
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
            const id = this.nextComponentId++;
            this.componentIdMap.set(componentClass, id);
            this.componentClasses.set(id, componentClass);
            // レジストリの初期化
            this.componentRegistry.set(id, {
                entities: new Set(),
                components: new Map()
            });
        }
        return this.componentIdMap.get(componentClass);
    }
    
    /**
     * コンポーネントIDからクラスを取得
     * @param {number} componentId
     * @returns {Function|null}
     */
    _getComponentClassById(componentId) {
        return this.componentClasses.get(componentId) || null;
    }
    
    // === Entity and Component Methods ===
    createEntity() {
        const entityId = this.nextEntityId++;
        this.entities.set(entityId, new Set());
        return entityId;
    }
    
    addComponent(entityId, component) {
        const componentClass = component.constructor;
        const componentId = this._getComponentId(componentClass);
        
        const entityComponents = this.entities.get(entityId);
        if (!entityComponents) {
            console.error(`Attempted to add component to non-existent entity ${entityId}`);
            return;
        }
        
        const isNew = !entityComponents.has(componentClass);
        entityComponents.add(componentClass);
        
        // コンポーネントレジストリへの登録
        const registry = this.componentRegistry.get(componentId);
        registry.entities.add(entityId);
        registry.components.set(entityId, component);
        
        // クエリの更新
        this._updateQueriesForComponent(entityId, componentId, true);
    }
    
    getComponent(entityId, componentClass) {
        const componentId = this.componentIdMap.get(componentClass);
        if (componentId === undefined) return null;
        
        const registry = this.componentRegistry.get(componentId);
        if (!registry) return null;
        
        return registry.components.get(entityId) || null;
    }
    
    removeComponent(entityId, componentClass) {
        const componentId = this.componentIdMap.get(componentClass);
        if (componentId === undefined) return;
        
        const entityComponents = this.entities.get(entityId);
        if (entityComponents && entityComponents.has(componentClass)) {
            entityComponents.delete(componentClass);
            
            // コンポーネントレジストリからの削除
            const registry = this.componentRegistry.get(componentId);
            registry.entities.delete(entityId);
            registry.components.delete(entityId);
            
            // クエリの更新
            this._updateQueriesForComponent(entityId, componentId, false);
        }
    }
    
    /**
     * 指定されたクラスのコンポーネントを検索し、存在すればそのインスタンスを返します。
     * 重要: この関数はコンポーネントを自動生成・登録しません。既存のコンポーネントのみを取得します。
     * @param {Function} componentClass - 取得したいコンポーネントのクラス
     * @returns {Object|null} コンポーネントのインスタンスまたはnull
     */
    getSingletonComponent(componentClass) {
        const componentId = this.componentIdMap.get(componentClass);
        if (componentId === undefined) return null;
        
        const registry = this.componentRegistry.get(componentId);
        if (!registry || registry.entities.size === 0) {
            return null;
        }
        
        // 最初に見つかったコンポーネントを返す
        const firstEntityId = registry.entities.values().next().value;
        return registry.components.get(firstEntityId) || null;
    }
    
    /**
     * コンポーネントの組み合わせを指定してエンティティを取得します。
     * O(1) でキャッシュされたクエリを取得します。
     * @param  {...Function} componentClasses
     * @returns {number[]}
     */
    getEntitiesWith(...componentClasses) {
        // 署名の生成
        const componentIds = componentClasses.map(c => this._getComponentId(c)).sort((a, b) => a - b);
        const signature = componentIds.join('|');
        
        let query = this.queries.get(signature);
        // なければ作成
        if (!query) {
            query = new Query(this, componentClasses, componentIds);
            this.queries.set(signature, query);
        }
        return query.getEntities();
    }
    
    destroyEntity(entityId) {
        const componentClasses = this.entities.get(entityId);
        if (componentClasses) {
            // 全てのコンポーネントを削除
            for (const componentClass of componentClasses) {
                this.removeComponent(entityId, componentClass);
            }
        }
        this.entities.delete(entityId);
        
        // クエリから削除
        for (const query of this.queries.values()) {
            query.onEntityRemoved(entityId);
        }
    }
    
    /**
     * 特定のコンポーネントの変更をクエリに通知
     * @param {number} entityId 
     * @param {number} componentId 
     * @param {boolean} isAdded 
     */
    _updateQueriesForComponent(entityId, componentId, isAdded) {
        // 署名にこのcomponentIdを含むクエリのみを更新
        for (const [signature, query] of this.queries) {
            if (signature.includes(`|${componentId}|`) || 
                signature.startsWith(`${componentId}|`) || 
                signature.endsWith(`|${componentId}`) ||
                signature === `${componentId}`) {
                query.onEntityComponentUpdated(entityId, componentId, isAdded);
            }
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
        
        // エンティティとコンポーネントのクリア
        this.entities.clear();
        
        // 高速アクセス用レジストリのクリア
        this.componentRegistry.clear();
        this.componentClasses.clear();
        this.componentIdMap.clear();
        
        // クエリのクリア
        this.queries.clear();
        
        // IDカウンタのリセット
        this.nextEntityId = 0;
        this.nextComponentId = 0;
    }
}