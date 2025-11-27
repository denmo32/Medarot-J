import { System } from '../../../../engine/core/System.js';
import { Position, Gauge, GameState, PlayerInfo } from '../../components/index.js';
import { PlayerStateType } from '../../common/constants.js';
import { TeamID } from '../../../common/constants.js';
import { CONFIG } from '../../common/config.js';

export class MovementSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(PlayerInfo, Position, Gauge, GameState);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);
            const position = this.world.getComponent(entityId, Position);

            const progress = gauge.value / gauge.max;
            let positionXRatio;

            const isTeam1 = playerInfo.teamId === TeamID.TEAM1;
            const startLine = isTeam1 ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1 : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
            const actionLine = isTeam1 ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1 : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;

            switch(gameState.state) {
                case PlayerStateType.SELECTED_CHARGING:
                    positionXRatio = startLine + (actionLine - startLine) * progress;
                    if (isTeam1) {
                        positionXRatio = Math.min(positionXRatio, actionLine);
                    } else {
                        positionXRatio = Math.max(positionXRatio, actionLine);
                    }
                    break;
                case PlayerStateType.CHARGING:
                    positionXRatio = actionLine + (startLine - actionLine) * progress;
                    if (isTeam1) {
                        positionXRatio = Math.max(positionXRatio, startLine);
                    } else {
                        positionXRatio = Math.min(positionXRatio, startLine);
                    }
                    break;
                case PlayerStateType.READY_EXECUTE:
                    positionXRatio = actionLine;
                    break;
                case PlayerStateType.GUARDING:
                    positionXRatio = actionLine;
                    break;
                case PlayerStateType.COOLDOWN_COMPLETE:
                case PlayerStateType.READY_SELECT:
                    positionXRatio = startLine;
                    break;
                default:
                     positionXRatio = position.x;
                     break;
            }
            
            position.x = positionXRatio;
        }
    }
}