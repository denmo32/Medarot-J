/**
 * @file 位置設定ユーティリティ
 */
import { Position, PlayerInfo } from '../components/index.js';
import { TeamID } from '../../common/constants.js';
import { CONFIG } from '../common/config.js';

export function snapToActionLine(world, entityId) {
    const position = world.getComponent(entityId, Position);
    const playerInfo = world.getComponent(entityId, PlayerInfo);

    if (!position || !playerInfo) return;

    position.x = playerInfo.teamId === TeamID.TEAM1
        ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
        : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
}

export function snapToHomePosition(world, entityId) {
    const position = world.getComponent(entityId, Position);
    const playerInfo = world.getComponent(entityId, PlayerInfo);

    if (!position || !playerInfo) return;

    position.x = playerInfo.teamId === TeamID.TEAM1
        ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
        : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
}