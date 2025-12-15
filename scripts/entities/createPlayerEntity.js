/**
 * @file createPlayerEntity.js
 * @description マップシーン用のプレイヤーEntityを生成する関数
 */

import * as MapComponents from '../map/MapComponents.js';
import { CONFIG as MAP_CONFIG, PLAYER_STATES } from '../map/constants.js';

/**
 * マップシーン用のプレイヤーEntityを生成する
 * @param {Object} world - ECSワールド
 * @param {Object} gameDataManager - ゲームデータ管理オブジェクト
 * @returns {number} 生成されたエンティティID
 */
export function createPlayerEntity(world, gameDataManager) {
    const playerEntityId = world.createEntity();
    const mapPlayerData = gameDataManager.gameData.playerPosition;

    world.addComponent(playerEntityId, new MapComponents.Position(mapPlayerData.x, mapPlayerData.y));
    world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
    world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
    world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
    world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
    world.addComponent(playerEntityId, new MapComponents.FacingDirection(mapPlayerData.direction));

    return playerEntityId;
}