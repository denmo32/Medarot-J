/**
 * @file MovementSystem.js
 * @description マップ移動システム。
 */
import { System } from '../../../engine/core/System.js';
import * as MapComponents from '../MapComponents.js'; // パス修正
import { CONFIG, PLAYER_STATES, TILE_TYPES } from '../constants.js';
import { distance } from '../../../engine/utils/MathUtils.js';
import { SceneChangeRequest } from '../../components/SceneRequests.js';

export class MovementSystem extends System {
    constructor(world, map) {
        super(world);
        this.map = map;
    }

    update(deltaTime) {
        const entities = this.getEntities(
            MapComponents.Position, 
            MapComponents.State, 
            MapComponents.TargetPosition,
            MapComponents.Collision
        );
        
        const speed = CONFIG.PLAYER_SPEED_PPS;

        for (const entityId of entities) {
            const position = this.world.getComponent(entityId, MapComponents.Position);
            const state = this.world.getComponent(entityId, MapComponents.State);
            const targetPosition = this.world.getComponent(entityId, MapComponents.TargetPosition);
            const collision = this.world.getComponent(entityId, MapComponents.Collision);

            if (state.value !== PLAYER_STATES.WALKING) {
                continue;
            }

            const moveAmount = speed * (deltaTime / 1000);
            const dist = distance(position.x, position.y, targetPosition.x, targetPosition.y);

            // 到達判定
            if (dist <= moveAmount) {
                // スナップ
                position.x = targetPosition.x;
                position.y = targetPosition.y;
                state.value = PLAYER_STATES.IDLE;
                this.world.removeComponent(entityId, MapComponents.TargetPosition);

                // 到達時のイベント判定 (足元のタイル)
                const centerX = position.x + collision.width / 2;
                const centerY = position.y + collision.height / 2;
                const tileX = Math.floor(centerX / CONFIG.TILE_SIZE);
                const tileY = Math.floor(centerY / CONFIG.TILE_SIZE);
                const currentTileType = this.map.getTileType(tileX, tileY);

                if (currentTileType === TILE_TYPES.BATTLE_TRIGGER) {
                    const req = this.world.createEntity();
                    this.world.addComponent(req, new SceneChangeRequest('battle'));
                }

            } else {
                // 移動中
                const dx = targetPosition.x - position.x;
                const dy = targetPosition.y - position.y;
                
                position.x += (dx / dist) * moveAmount;
                position.y += (dy / dist) * moveAmount;
            }
        }
    }
}