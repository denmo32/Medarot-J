/**
 * @file createCustomizeContextEntity.js
 * @description カスタマイズシーンのコンテキストEntityを生成する関数
 */

import { CustomizeState } from '../customize/components/CustomizeState.js';

/**
 * カスタマイズシーンのコンテキストEntityを生成する
 * @param {Object} world - ECSワールド
 * @returns {number} 生成されたコンテキストエンティティID
 */
export function createCustomizeContextEntity(world) {
    const contextEntity = world.createEntity();
    world.addComponent(contextEntity, new CustomizeState());
    return contextEntity;
}