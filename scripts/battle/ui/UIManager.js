/**
 * @file UI管理システム
 * @description DOM要素とエンティティのマッピングを管理し、UIとロジックの分離を実現します。
 */
import { GameEvents } from '../../common/events.js'; // 未使用ですが参照整合性のためにimport

export class UIManager {
    constructor() {
        this.entityDOMMap = new Map(); // entityId -> DOM要素のマッピング
    }

    /**
     * エンティティIDとDOM要素のマッピングを登録します
     * @param {number} entityId - エンティティID
     * @param {object} domElements - DOM要素のオブジェクト
     */
    registerEntity(entityId, domElements) {
        this.entityDOMMap.set(entityId, domElements);
    }

    /**
     * エンティティIDに対応するDOM要素を取得します
     * @param {number} entityId - エンティティID
     * @returns {object | null} DOM要素オブジェクト、またはnull
     */
    getDOMElements(entityId) {
        return this.entityDOMMap.get(entityId) || null;
    }

    /**
     * 指定されたエンティティのDOM要素マッピングを削除します
     * @param {number} entityId - 削除対象のエンティティID
     */
    unregisterEntity(entityId) {
        this.entityDOMMap.delete(entityId);
    }

    /**
     * 全てのDOM要素マッピングをクリアします
     */
    clear() {
        this.entityDOMMap.clear();
    }
}