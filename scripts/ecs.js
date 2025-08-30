import { GamePhaseType } from './constants.js';

export class World {
    constructor() {
        this.entities = new Map(); // entityId -> Set<Component>
        this.nextEntityId = 0;
        this.systems = [];

        // componentClass -> Map<entityId, componentInstance>
        this.components = new Map();

        // --- New: Event Dispatcher ---
        this.listeners = new Map(); // eventName -> Set<callback>

        // --- New: Global Game State ---
        this.gamePhase = {
            phase: GamePhaseType.IDLE,
            activePlayer: null,
            isModalActive: false,
        };
    }

    // --- New: Event Dispatcher Methods ---
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(callback);
    }

    emit(eventName, detail) {
        if (this.listeners.has(eventName)) {
            for (const callback of this.listeners.get(eventName)) {
                callback(detail);
            }
        }
    }

    // --- Entity and Component Methods ---
    createEntity() {
        const entityId = this.nextEntityId++;
        this.entities.set(entityId, new Set());
        return entityId;
    }

    addComponent(entityId, component) {
        this.entities.get(entityId).add(component.constructor);

        if (!this.components.has(component.constructor)) {
            this.components.set(component.constructor, new Map());
        }
        this.components.get(component.constructor).set(entityId, component);
    }

    getComponent(entityId, componentClass) {
        return this.components.get(componentClass)?.get(entityId);
    }

    getEntitiesWith(...componentClasses) {
        const entities = [];
        for (const [entityId, components] of this.entities.entries()) {
            if (componentClasses.every(componentClass => components.has(componentClass))) {
                entities.push(entityId);
            }
        }
        return entities;
    }

    destroyEntity(entityId) {
        const componentClasses = this.entities.get(entityId);
        if (componentClasses) {
            for (const componentClass of componentClasses) {
                const componentMap = this.components.get(componentClass);
                if (componentMap) {
                    componentMap.delete(entityId);
                }
            }
        }
        this.entities.delete(entityId);
    }

    // --- System Methods ---
    registerSystem(system) {
        this.systems.push(system);
    }

    update(deltaTime) {
        for (const system of this.systems) {
            system.update(deltaTime);
        }
    }
}