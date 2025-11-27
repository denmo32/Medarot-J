/**
 * @file マップシーン：インタラクションシステム
 */
import { System } from '../../../engine/core/System.js';
import { Position } from '../../components/map/Position.js';
import { FacingDirection } from '../../components/map/FacingDirection.js';
import { CONFIG } from '../constants.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { GameEvents } from '../../common/events.js';

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

        const position = this.world.getComponent(entityId, Position);
        const facingDirection = this.world.getComponent(entityId, FacingDirection);
        if (!position || !facingDirection) return;

        const playerTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const playerTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);

        for (const npc of this.map.npcs) {
            const isFacingNpc = 
                (playerTileX === npc.x && playerTileY === npc.y - 1 && facingDirection.direction === 'down') ||
                (playerTileX === npc.x && playerTileY === npc.y + 1 && facingDirection.direction === 'up') ||
                (playerTileX === npc.x - 1 && playerTileY === npc.y && facingDirection.direction === 'right') ||
                (playerTileX === npc.x + 1 && playerTileY === npc.y && facingDirection.direction === 'left');

            if (isFacingNpc) {
                this.world.emit(GameEvents.NPC_INTERACTION_REQUESTED, npc);
                break;
            }
        }
    }
}
