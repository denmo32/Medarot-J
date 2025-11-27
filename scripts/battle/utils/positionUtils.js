/**
 * @file 位置設定ユーティリティ
 */
// Positionはbattle固有のコンポーネント: scripts/battle/utils/ -> ../components/index.js (scripts/battle/components/index.js)
import { Position } from '../components/index.js';
// PlayerInfoは共通コンポーネント: scripts/battle/utils/ -> ../../components/index.js (scripts/components/index.js)
import { PlayerInfo } from '../../components/index.js';
// TeamIDは共通定数: scripts/battle/utils/ -> ../../common/constants.js (scripts/common/constants.js)
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