/**
 * @file ComponentUpdateSystem.js
 * @description 汎用的なコンポーネント更新リクエストを処理するシステム。
 */
import { System } from '../../../../engine/core/System.js';
import { UpdateComponentRequest, CustomUpdateComponentRequest } from '../../components/CommandRequests.js';

function _deepMerge(target, source) {
    for (const key in source) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
            _deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
}

export class ComponentUpdateSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // --- 汎用更新リクエスト ---
        const updateEntities = this.getEntities(UpdateComponentRequest);
        for (const entityId of updateEntities) {
            const request = this.world.getComponent(entityId, UpdateComponentRequest);
            const component = this.world.getComponent(request.targetId, request.componentType);
            if (component) {
                _deepMerge(component, request.updates);
            }
            this.world.destroyEntity(entityId); // リクエストエンティティを削除
        }

        // --- カスタム更新リクエスト ---
        const customUpdateEntities = this.getEntities(CustomUpdateComponentRequest);
        for (const entityId of customUpdateEntities) {
            const request = this.world.getComponent(entityId, CustomUpdateComponentRequest);
            const component = this.world.getComponent(request.targetId, request.componentType);
            if (component && request.customHandler) {
                request.customHandler(component, this.world);
            }
            this.world.destroyEntity(entityId); // リクエストエンティティを削除
        }
    }
}