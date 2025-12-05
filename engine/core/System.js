/**
 * @file システム基底クラス
 */
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class System {
    constructor(world) {
        this.world = world;
        this._boundListeners = [];
    }

    update(deltaTime) {
        // デフォルトでは何もしない
    }

    execute(deltaTime) {
        try {
            this.update(deltaTime);
        } catch (error) {
            ErrorHandler.handle(error, {
                system: this.constructor.name,
                method: 'update'
            });
        }
    }

    on(eventName, callback) {
        const wrappedCallback = (...args) => {
            try {
                callback(...args);
            } catch (error) {
                ErrorHandler.handle(error, {
                    system: this.constructor.name,
                    event: eventName,
                    method: 'eventHandler'
                });
            }
        };

        this.world.on(eventName, wrappedCallback);
        this._boundListeners.push({ eventName, callback: wrappedCallback });
    }

    destroy() {
        for (const { eventName, callback } of this._boundListeners) {
            this.world.off(eventName, callback);
        }
        this._boundListeners = [];
    }

    getEntities(...componentClasses) {
        return this.world.getEntitiesWith(...componentClasses);
    }

    isValidEntity(entityId) {
        return this.world.entities.has(entityId);
    }

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

    emitEvent(eventName, detail = {}) {
        this.world.emit(eventName, detail);
    }
}