/**
 * @file ECS (Entity-Component-System) の中核クラス
 * @description エンティティ、コンポーネント、システムの管理を行います。
 * イベントバス(EventManager)を削除し、純粋なデータ駆動アーキテクチャを強制します。
 */
import { Query } from './Query.js';

export class World {
    constructor() {
        // key: entityId, value: Set<ComponentClass>
        this.entities = new Map();
        this.nextEntityId = 0;
        
        // key: componentId (number), value: ComponentClass
        this.componentClasses = new Map();
        
        // --- System Storage ---
        this.systems = [];
        
        // --- Query Storage ---
        // key: componentIdSignature (string), value: Query
        this.queries = new Map();
        
        // --- Component ID Management ---
        // key: ComponentClass, value: number (unique ID)
        this.componentIdMap = new Map();
        this.nextComponentId = 0;
        
        // --- 高速アクセス用マッピング ---
        // key: componentId, value: { entities: Set<number>, components: Map<number, any> }
        this.componentRegistry = new Map();
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
     * シングルトンコンポーネント（TagやManager等）の取得
     * @param {Function} componentClass 
     * @returns {Object|null}
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
    
    _updateQueriesForComponent(entityId, componentId, isAdded) {
        // 単純な部分一致検索ではなく、IDが含まれるか厳密にチェック（Queryクラス側で詳細判定）
        for (const [, query] of this.queries) {
             if (query.componentIds.has(componentId)) {
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
    
    reset() {
        for (const system of this.systems) {
            if (system.destroy) {
                system.destroy();
            }
        }
        this.systems = [];
        
        this.entities.clear();
        this.componentRegistry.clear();
        this.componentClasses.clear();
        this.componentIdMap.clear();
        this.queries.clear();
        
        this.nextEntityId = 0;
        this.nextComponentId = 0;
    }
}