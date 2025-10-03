import { BaseSystem } from '../../core/baseSystem.js';
import * as MapComponents from '../components.js';
import { CONFIG, PLAYER_STATES } from '../constants.js';
import { UIStateContext } from '../../battle/core/UIStateContext.js';

/**
 * プレイヤーの入力に基づいて目標タイルを設定し、状態を遷移させるシステム。
 * UI関連の処理はイベントを発行し、MapUISystemに委譲する。
 */
export class PlayerInputSystem extends BaseSystem {
    constructor(world, input, map) {
        super(world);
        this.input = input;
        this.map = map;
    }

    update() {
        const uiStateContext = this.world.getSingletonComponent(UIStateContext);
        // メニューやモーダル表示中はプレイヤーのマップ操作をブロック
        if (uiStateContext && uiStateContext.isPausedByModal) {
            return;
        }

        this.handleMapInput();
    }

    handleMapInput() {
        const entities = this.world.getEntitiesWith(
            MapComponents.PlayerControllable, 
            MapComponents.State, 
            MapComponents.Position,
            MapComponents.Collision
        );

        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, MapComponents.State);

            // アイドル状態での移動入力
            if (state.value === PLAYER_STATES.IDLE && this.input.direction) {
                this.handleMovementInput(entityId);
            }

            // インタラクション入力
            if (this.input.wasKeyJustPressed('z')) {
                this.handleInteractionInput(entityId);
            }
        }
    }

    handleMovementInput(entityId) {
        const position = this.world.getComponent(entityId, MapComponents.Position);
        const collision = this.world.getComponent(entityId, MapComponents.Collision);
        const state = this.world.getComponent(entityId, MapComponents.State);

        let targetX = position.x;
        let targetY = position.y;

        const currentTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const currentTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const baseTargetX = currentTileX * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
        const baseTargetY = currentTileY * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;

        switch (this.input.direction) {
            case 'up':    targetY = baseTargetY - CONFIG.TILE_SIZE; break;
            case 'down':  targetY = baseTargetY + CONFIG.TILE_SIZE; break;
            case 'left':  targetX = baseTargetX - CONFIG.TILE_SIZE; break;
            case 'right': targetX = baseTargetX + CONFIG.TILE_SIZE; break;
        }

        const bounds = { x: targetX, y: targetY, width: collision.width, height: collision.height };

        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        if (facingDirection) facingDirection.direction = this.input.direction;
        else this.world.addComponent(entityId, new MapComponents.FacingDirection(this.input.direction));

        if (!this.map.isColliding(bounds)) {
            state.value = PLAYER_STATES.WALKING;
            this.world.addComponent(entityId, new MapComponents.TargetPosition(targetX, targetY));
        }
    }

    handleInteractionInput(entityId) {
        const position = this.world.getComponent(entityId, MapComponents.Position);
        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        const playerTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const playerTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);

        for (const npc of this.map.npcs) {
            if (
                (playerTileX === npc.x && playerTileY === npc.y - 1 && facingDirection.direction === 'down') ||
                (playerTileX === npc.x && playerTileY === npc.y + 1 && facingDirection.direction === 'up') ||
                (playerTileX === npc.x - 1 && playerTileY === npc.y && facingDirection.direction === 'right') ||
                (playerTileX === npc.x + 1 && playerTileY === npc.y && facingDirection.direction === 'left')
            ) {
                this.world.emit('NPC_INTERACTION_REQUESTED', npc);
                break;
            }
        }
    }
}
