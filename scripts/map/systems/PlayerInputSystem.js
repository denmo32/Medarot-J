/**
 * @file PlayerInputSystem.js
 * @description プレイヤー入力のハンドリング
 * グリッド移動方式への復帰。移動中は入力を受け付けず、入力時に1タイル分の移動先を決定する。
 */
import { System } from '../../../engine/core/System.js';
import * as MapComponents from '../components.js';
import { CONFIG, PLAYER_STATES } from '../constants.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { GameEvents } from '../../common/events.js';
import { InputManager } from '../../../engine/input/InputManager.js';

export class PlayerInputSystem extends System {
    constructor(world, map) {
        super(world);
        this.input = this.world.getSingletonComponent(InputManager);
        this.map = map;
    }

    update() {
        if (!this.input) return;

        const mapUIState = this.world.getSingletonComponent(MapUIState);
        if (mapUIState && mapUIState.isPausedByModal) {
            return;
        }

        this.handleMapInput();
    }

    handleMapInput() {
        const entities = this.getEntities(
            MapComponents.PlayerControllable, 
            MapComponents.State, 
            MapComponents.Position,
            MapComponents.Collision
        );

        for (const entityId of entities) {
            this._handleMovement(entityId);

            if (this.input.wasKeyJustPressed('z')) {
                this.world.emit(GameEvents.INTERACTION_KEY_PRESSED, { entityId });
            }
        }
    }

    _handleMovement(entityId) {
        const state = this.world.getComponent(entityId, MapComponents.State);
        
        // 移動中は入力を受け付けない（グリッド移動の基本）
        if (state.value !== PLAYER_STATES.IDLE) {
            return;
        }

        let direction = null;
        if (this.input.isKeyPressed('ArrowUp')) direction = 'up';
        else if (this.input.isKeyPressed('ArrowDown')) direction = 'down';
        else if (this.input.isKeyPressed('ArrowLeft')) direction = 'left';
        else if (this.input.isKeyPressed('ArrowRight')) direction = 'right';

        if (direction) {
            this._updateFacingDirection(entityId, direction);
            this._tryMove(entityId, direction);
        }
    }

    _tryMove(entityId, direction) {
        const position = this.world.getComponent(entityId, MapComponents.Position);
        const collision = this.world.getComponent(entityId, MapComponents.Collision);

        // 移動先の座標（タイルの中央）を計算
        const targetPos = this._calculateTargetPosition(position, direction);

        // 衝突判定用の矩形
        const bounds = { 
            x: targetPos.x, 
            y: targetPos.y, 
            width: collision.width, 
            height: collision.height 
        };

        if (!this.map.isColliding(bounds)) {
            this._applyMovement(entityId, targetPos);
        }
    }

    _calculateTargetPosition(position, direction) {
        // 現在の中心座標からタイルインデックスを算出
        const centerX = position.x + CONFIG.PLAYER_SIZE / 2;
        const centerY = position.y + CONFIG.PLAYER_SIZE / 2;
        const currentTileX = Math.floor(centerX / CONFIG.TILE_SIZE);
        const currentTileY = Math.floor(centerY / CONFIG.TILE_SIZE);
        
        // タイルの中央に配置するためのオフセット計算
        const offset = (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
        const baseX = currentTileX * CONFIG.TILE_SIZE + offset;
        const baseY = currentTileY * CONFIG.TILE_SIZE + offset;

        let targetX = baseX;
        let targetY = baseY;

        // 隣接タイルへの移動
        switch (direction) {
            case 'up':    targetY -= CONFIG.TILE_SIZE; break;
            case 'down':  targetY += CONFIG.TILE_SIZE; break;
            case 'left':  targetX -= CONFIG.TILE_SIZE; break;
            case 'right': targetX += CONFIG.TILE_SIZE; break;
        }
        
        return { x: targetX, y: targetY };
    }

    _updateFacingDirection(entityId, direction) {
        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        if (facingDirection) {
            facingDirection.direction = direction;
        } else {
            this.world.addComponent(entityId, new MapComponents.FacingDirection(direction));
        }
    }

    _applyMovement(entityId, targetPos) {
        const state = this.world.getComponent(entityId, MapComponents.State);
        state.value = PLAYER_STATES.WALKING;
        
        // TargetPositionコンポーネントを付与して移動システムに委譲
        const targetPosition = this.world.getComponent(entityId, MapComponents.TargetPosition);
        if (targetPosition) {
            targetPosition.x = targetPos.x;
            targetPosition.y = targetPos.y;
        } else {
            this.world.addComponent(entityId, new MapComponents.TargetPosition(targetPos.x, targetPos.y));
        }
    }
}