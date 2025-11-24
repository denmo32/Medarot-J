/**
 * @file マップシーン：インタラクションシステム
 * プレイヤーからのインタラクション要求に基づき、周囲のNPCなどを探索し、
 * 適切なイベントを発行する責務を持ちます。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import * as MapComponents from '../components.js';
import { CONFIG } from '../constants.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { GameEvents } from '../../battle/common/events.js';

export class InteractionSystem extends BaseSystem {
    constructor(world, map) {
        super(world);
        this.map = map;
        this.world.on(GameEvents.INTERACTION_KEY_PRESSED, this.onInteractionKeyPressed.bind(this));
    }

    onInteractionKeyPressed(detail) {
        const { entityId } = detail;
        const mapUIState = this.world.getSingletonComponent(MapUIState);
        // UI操作中はインタラクションを無効化
        if (mapUIState && mapUIState.isPausedByModal) {
            return;
        }

        const position = this.world.getComponent(entityId, MapComponents.Position);
        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
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
                // MapUISystemにNPCとのインタラクションUI表示を要求
                this.world.emit(GameEvents.NPC_INTERACTION_REQUESTED, npc);
                break; // 最初に見つかったNPCとのみインタラクト
            }
        }
    }
}