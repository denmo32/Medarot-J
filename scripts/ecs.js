export class World {
    constructor() {
        this.entities = new Map(); // entityId -> Set<Component>
        this.nextEntityId = 0;
        this.systems = [];

        // componentClass -> Map<entityId, componentInstance>
        this.components = new Map(); 
    }

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

    registerSystem(system) {
        this.systems.push(system);
    }

    update(deltaTime) {
        for (const system of this.systems) {
            system.update(deltaTime);
        }
    }
}
