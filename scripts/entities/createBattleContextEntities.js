/**
 * @file createBattleContextEntities.js
 * @description バトルシーンのコンテキストEntityを生成する関数
 */

import { BattleFlowState } from '../battle/components/BattleFlowState.js';
import { TurnContext } from '../battle/components/TurnContext.js';
import { PhaseState } from '../battle/components/PhaseState.js';
import { BattleHistoryContext } from '../battle/components/BattleHistoryContext.js';
import { BattleUIState } from '../battle/components/BattleUIState.js';
import { UIManager } from '../../engine/ui/UIManager.js';

/**
 * バトルシーンの主要なコンテキストEntityを生成する
 * @param {Object} world - ECSワールド
 * @returns {number} 生成されたコンテキストエンティティID
 */
export function createBattleContextEntities(world) {
    const contextEntity = world.createEntity();

    world.addComponent(contextEntity, new BattleFlowState());
    world.addComponent(contextEntity, new TurnContext());
    world.addComponent(contextEntity, new PhaseState());
    world.addComponent(contextEntity, new BattleHistoryContext());

    return contextEntity;
}

/**
 * バトルUIのコンテキストEntityを生成する
 * @param {Object} world - ECSワールド
 * @returns {number} 生成されたUIコンテキストエンティティID
 */
export function createBattleUIContextEntity(world) {
    const uiContextEntity = world.createEntity();

    world.addComponent(uiContextEntity, new BattleUIState());
    world.addComponent(uiContextEntity, new UIManager());

    return uiContextEntity;
}