/**
 * @file UI管理クラス
 * @description エンティティとDOM要素のマッピングを管理します。
 */
export class UIManager {
    constructor() {
        this.entityDOMMap = new Map();
    }

    registerEntity(entityId, domElements) {
        this.entityDOMMap.set(entityId, domElements);
    }

    getDOMElements(entityId) {
        return this.entityDOMMap.get(entityId) || null;
    }

    unregisterEntity(entityId) {
        this.entityDOMMap.delete(entityId);
    }

    clear() {
        this.entityDOMMap.clear();
    }
}