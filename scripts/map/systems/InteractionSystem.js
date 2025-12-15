/**
 * @file InteractionSystem.js
 * @description マップ上のインタラクション処理。
 */
import { System } from '../../../engine/core/System.js';
import * as MapComponents from '../MapComponents.js'; // パス修正
import { CONFIG } from '../constants.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { InteractionRequest, ShowNpcDialogRequest } from '../components/MapRequests.js'; 

const DIRECTION_OFFSETS = {
    'up': { x: 0, y: -1 },
    'down': { x: 0, y: 1 },
    'left': { x: -1, y: 0 },
    'right': { x: 1, y: 0 }
};

export class InteractionSystem extends System {
    constructor(world, map) {
        super(world);
        this.map = map;
    }

    update(deltaTime) {
        // InteractionRequest を監視
        const requests = this.getEntities(InteractionRequest);
        
        for (const reqId of requests) {
            const request = this.world.getComponent(reqId, InteractionRequest);
            this._handleInteraction(request.entityId);
            this.world.destroyEntity(reqId);
        }
    }

    _handleInteraction(entityId) {
        const mapUIState = this.world.getSingletonComponent(MapUIState);
        
        if (mapUIState && mapUIState.isPausedByModal) {
            return;
        }

        const position = this.world.getComponent(entityId, MapComponents.Position);
        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        if (!position || !facingDirection) return;

        const playerTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const playerTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);

        const offset = DIRECTION_OFFSETS[facingDirection.direction];
        if (!offset) return;

        const targetX = playerTileX + offset.x;
        const targetY = playerTileY + offset.y;

        const targetNpc = this.map.npcs.find(npc => npc.x === targetX && npc.y === targetY);

        if (targetNpc) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new ShowNpcDialogRequest(targetNpc));
        }
    }
}