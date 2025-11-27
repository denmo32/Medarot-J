import { System } from '../../../engine/core/System.js';
import { Position } from '../../components/map/Position.js';
import { State } from '../../components/map/State.js';
import { TargetPosition } from '../../components/map/TargetPosition.js';
import { CONFIG, PLAYER_STATES, MAP_EVENTS, TILE_TYPES } from '../constants.js';
import { distance } from '../../../engine/utils/MathUtils.js';

export class MovementSystem extends System {
    constructor(world, map) {
        super(world);
        this.map = map;
    }

    update(deltaTime) {
        const entities = this.getEntities(
            Position, 
            State, 
            TargetPosition
        );
        const speed = CONFIG.PLAYER_SPEED_PPS;

        for (const entityId of entities) {
            const position = this.world.getComponent(entityId, Position);
            const state = this.world.getComponent(entityId, State);
            const targetPosition = this.world.getComponent(entityId, TargetPosition);

            if (state.value !== PLAYER_STATES.WALKING || !targetPosition) {
                continue;
            }

            const moveAmount = speed * (deltaTime / 1000);
            const dist = distance(position.x, position.y, targetPosition.x, targetPosition.y);

            if (dist <= moveAmount) {
                position.x = targetPosition.x;
                position.y = targetPosition.y;
                state.value = PLAYER_STATES.IDLE;
                this.world.removeComponent(entityId, TargetPosition);

                const tileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
                const tileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
                const currentTileType = this.map.getTileType(tileX, tileY);

                if (currentTileType === TILE_TYPES.BATTLE_TRIGGER) {
                    this.world.emit(MAP_EVENTS.BATTLE_TRIGGERED);
                }

            } else {
                const dx = targetPosition.x - position.x;
                const dy = targetPosition.y - position.y;
                
                position.x += (dx / dist) * moveAmount;
                position.y += (dy / dist) * moveAmount;
            }
        }
    }
}
