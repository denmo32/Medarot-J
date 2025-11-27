/**
 * @file マップシーン：インタラクションシステム
 */
import { System } from '../../../engine/core/System.js';
import * as MapComponents from '../components.js';
import { CONFIG } from '../constants.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { GameEvents } from '../../common/events.js';

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
        this.on(GameEvents.INTERACTION_KEY_PRESSED, this.onInteractionKeyPressed.bind(this));
    }

    onInteractionKeyPressed(detail) {
        const { entityId } = detail;
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
            this.world.emit(GameEvents.NPC_INTERACTION_REQUESTED, targetNpc);
        }
    }
}