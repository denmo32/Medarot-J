/**
 * @file ECS (Entity-Component-System) の中核クラス
 * @description エンティティ、コンポーネント、システムの管理とオーケストレーションを行います。
 * イベント機能はEventEmitterを継承して提供します。
 */
import { EventEmitter } from '../event/EventEmitter.js';

export class World extends EventEmitter {
    constructor() {
        super();

        // --- Entity & Component Storage ---
        // key: entityId, value: Set<ComponentClass>
        this.entities = new Map();
        this.nextEntityId = 0;

        // key: ComponentClass, value: Map<entityId, componentInstance>
        this.components = new Map();

        // --- System Storage ---
        this.systems = [];

        // --- Query Cache ---
        // getEntitiesWithの結果をキャッシュ
        this.queryCache = new Map();
    }

    // === Entity and Component Methods ===

    /**
     * 新しいエンティティを生成します。
     * @returns {number} 新しいエンティティID
     */
    createEntity() {
        const entityId = this.nextEntityId++;
        this.entities.set(entityId, new Set());
        return entityId;
    }

    /**
     * エンティティにコンポーネントを追加します。
     * @param {number} entityId
     * @param {Object} component
     */
    addComponent(entityId, component) {
        const componentClass = component.constructor;
        this.entities.get(entityId).add(componentClass);

        if (!this.components.has(componentClass)) {
            this.components.set(componentClass, new Map());
        }
        this.components.get(componentClass).set(entityId, component);

        this.queryCache.clear();
    }

    /**
     * エンティティからコンポーネントを取得します。
     * @param {number} entityId
     * @param {Function} componentClass
     * @returns {Object|undefined}
     */
    getComponent(entityId, componentClass) {
        return this.components.get(componentClass)?.get(entityId);
    }

    /**
     * エンティティからコンポーネントを削除します。
     * @param {number} entityId
     * @param {Function} componentClass
     */
    removeComponent(entityId, componentClass) {
        if (this.entities.has(entityId)) {
            this.entities.get(entityId).delete(componentClass);
        }
        if (this.components.has(componentClass)) {
            this.components.get(componentClass).delete(entityId);
        }
        this.queryCache.clear();
    }

    /**
     * シングルトンコンポーネントを取得します。
     * @param {Function} componentClass
     * @returns {Object|null}
     */
    getSingletonComponent(componentClass) {
        const componentMap = this.components.get(componentClass);
        if (!componentMap || componentMap.size === 0) {
            return null;
        }
        return componentMap.values().next().value;
    }

    /**
     * 指定されたコンポーネント群を持つエンティティのリストを取得します。
     * @param  {...Function} componentClasses
     * @returns {number[]}
     */
    getEntitiesWith(...componentClasses) {
        if (componentClasses.length === 0) return [];

        const cacheKey = componentClasses
            .map(c => c.name)
            .sort()
            .join('|');

        if (this.queryCache.has(cacheKey)) {
            return this.queryCache.get(cacheKey);
        }

        const entities = [];

        // 最も要素数の少ないコンポーネントを基準に検索
        const baseComponentClass = componentClasses.reduce((min, current) => {
            const minSize = this.components.get(min)?.size || 0;
            const currentSize = this.components.get(current)?.size || 0;
            return currentSize < minSize ? current : min;
        }, componentClasses[0]);

        const baseComponentMap = this.components.get(baseComponentClass);
        
        if (baseComponentMap) {
            for (const entityId of baseComponentMap.keys()) {
                const entityComponents = this.entities.get(entityId);
                const hasAll = componentClasses.every(cls => 
                    cls === baseComponentClass || entityComponents.has(cls)
                );
                
                if (hasAll) {
                    entities.push(entityId);
                }
            }
        }

        this.queryCache.set(cacheKey, entities);
        return entities;
    }

    /**
     * エンティティとその全コンポーネントを削除します。
     * @param {number} entityId
     */
    destroyEntity(entityId) {
        const componentClasses = this.entities.get(entityId);
        if (componentClasses) {
            for (const componentClass of componentClasses) {
                this.components.get(componentClass)?.delete(entityId);
            }
        }
        this.entities.delete(entityId);
        this.queryCache.clear();
    }

    // === System Methods ===

    /**
     * システムを登録します。
     * @param {Object} system
     */
    registerSystem(system) {
        this.systems.push(system);
    }

    /**
     * 登録された全システムのupdateメソッドを実行します。
     * @param {number} deltaTime
     */
    update(deltaTime) {
        for (const system of this.systems) {
            if (system.update) {
                system.update(deltaTime);
            }
        }
    }

    /**
     * ワールドの状態をリセットします。
     */
    reset() {
        for (const system of this.systems) {
            if (system.destroy) {
                system.destroy();
            }
        }
        
        this.clearListeners(); // EventEmitterのメソッドを使用
        this.systems = [];
        this.entities.clear();
        this.components.clear();
        this.nextEntityId = 0;
        this.queryCache.clear();
    }
}