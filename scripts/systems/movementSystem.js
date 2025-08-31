// scripts/systems/movementSystem.js:

import { Position, Gauge, GameState, PlayerInfo } from '../components.js';
import { PlayerStateType, TeamID } from '../constants.js';
import { CONFIG } from '../config.js';

/**
 * エンティティの位置（Positionコンポーネント）を、ゲームの状態に基づいて更新するシステム。
 * ロジックと描画を分離する目的で新設されました。
 */
export class MovementSystem {
    constructor(world) {
        this.world = world;
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(PlayerInfo, Position, Gauge, GameState);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);
            const position = this.world.getComponent(entityId, Position);

            const progress = gauge.value / gauge.max;
            let positionXRatio;

            // チームに応じて、スタートラインとアクションラインの位置をconfigから取得
            const isTeam1 = playerInfo.teamId === TeamID.TEAM1;
            const startLine = isTeam1 ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1 : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
            const actionLine = isTeam1 ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1 : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;

            // ゲームの状態に応じて、プレイヤーのX座標の割合を計算
            switch(gameState.state) {
                case PlayerStateType.SELECTED_CHARGING: // 自陣 -> アクションライン
                    positionXRatio = startLine + (actionLine - startLine) * progress;
                    break;
                case PlayerStateType.CHARGING: // アクションライン -> 自陣
                    positionXRatio = actionLine + (startLine - actionLine) * progress;
                    break;
                case PlayerStateType.READY_EXECUTE:
                    positionXRatio = actionLine;
                    break;
                case PlayerStateType.COOLDOWN_COMPLETE:
                case PlayerStateType.READY_SELECT:
                    positionXRatio = startLine;
                    break;
                default:
                     positionXRatio = position.x; // 状態が変わらない場合は現在の位置を維持
                     break;
            }
            
            // 計算結果をPositionコンポーネントに反映
            position.x = positionXRatio;
        }
    }
}
