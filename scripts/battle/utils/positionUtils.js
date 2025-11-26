/**
 * @file 位置設定ユーティリティ
 * @description エンティティの位置を特定の位置（アクションラインなど）に設定するための共通関数を提供します。
 */
import { Position, PlayerInfo } from '../components/index.js';
import { TeamID } from '../../config/constants.js';
import { CONFIG } from '../../config/gameConfig.js';

/**
 * 指定されたエンティティを、そのチームのアクションライン上に配置します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 対象のエンティティID
 */
export function snapToActionLine(world, entityId) {
    const position = world.getComponent(entityId, Position);
    const playerInfo = world.getComponent(entityId, PlayerInfo);

    if (!position || !playerInfo) return;

    position.x = playerInfo.teamId === TeamID.TEAM1
        ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
        : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
}

/**
 * 指定されたエンティティを、そのチームのホームポジション（スタートライン）に配置します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 対象のエンティティID
 */
export function snapToHomePosition(world, entityId) {
    const position = world.getComponent(entityId, Position);
    const playerInfo = world.getComponent(entityId, PlayerInfo);

    if (!position || !playerInfo) return;

    position.x = playerInfo.teamId === TeamID.TEAM1
        ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
        : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
}
