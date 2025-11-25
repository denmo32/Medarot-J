import { BaseSystem } from '../../engine/baseSystem.js';
import * as MapComponents from '../components.js';
import { CONFIG, PLAYER_STATES } from '../constants.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { GameEvents } from '../../battle/common/events.js';
import { InputManager } from '../../engine/InputManager.js';

/**
 * プレイヤーの入力に基づいて目標タイルを設定し、状態を遷移させるシステム。
 */
export class PlayerInputSystem extends BaseSystem {
    constructor(world, map) {
        super(world);
        // InputManagerはシングルトンコンポーネントとしてWorldから取得
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
        const entities = this.world.getEntitiesWith(
            MapComponents.PlayerControllable, 
            MapComponents.State, 
            MapComponents.Position,
            MapComponents.Collision
        );

        for (const entityId of entities) {
            // アイドル状態での移動入力
            this._handleMovement(entityId);

            // インタラクション入力
            if (this.input.wasKeyJustPressed('z')) {
                this.world.emit(GameEvents.INTERACTION_KEY_PRESSED, { entityId });
            }
        }
    }

    /**
     * 移動入力の処理
     * @private
     */
    _handleMovement(entityId) {
        const state = this.world.getComponent(entityId, MapComponents.State);
        
        // 移動中でない場合のみ入力を受け付ける
        if (state.value !== PLAYER_STATES.IDLE || !this.input.direction) {
            return;
        }

        const direction = this.input.direction;

        // 1. 向きを更新
        this._updateFacingDirection(entityId, direction);

        // 2. 移動を試行
        this._tryMove(entityId, direction);
    }

    /**
     * 指定された方向への移動を試みます。
     * @private
     */
    _tryMove(entityId, direction) {
        const position = this.world.getComponent(entityId, MapComponents.Position);
        const collision = this.world.getComponent(entityId, MapComponents.Collision);

        // 移動先座標の計算
        const targetPos = this._calculateTargetPosition(position, direction);

        // 衝突判定
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

    /**
     * 現在位置と入力方向から目標座標を計算します。
     * @param {object} position - 現在の位置コンポーネント
     * @param {string} direction - 入力方向 ('up', 'down', 'left', 'right')
     * @returns {{x: number, y: number}} 目標座標
     */
    _calculateTargetPosition(position, direction) {
        const currentTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const currentTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        
        const baseTargetX = currentTileX * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
        const baseTargetY = currentTileY * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;

        let targetX = position.x;
        let targetY = position.y;

        switch (direction) {
            case 'up':    targetY = baseTargetY - CONFIG.TILE_SIZE; break;
            case 'down':  targetY = baseTargetY + CONFIG.TILE_SIZE; break;
            case 'left':  targetX = baseTargetX - CONFIG.TILE_SIZE; break;
            case 'right': targetX = baseTargetX + CONFIG.TILE_SIZE; break;
        }
        
        return { x: targetX, y: targetY };
    }

    /**
     * エンティティの向きを更新します。
     */
    _updateFacingDirection(entityId, direction) {
        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        if (facingDirection) {
            facingDirection.direction = direction;
        } else {
            this.world.addComponent(entityId, new MapComponents.FacingDirection(direction));
        }
    }

    /**
     * 移動を適用し、状態をWALKINGに変更します。
     */
    _applyMovement(entityId, targetPos) {
        const state = this.world.getComponent(entityId, MapComponents.State);
        state.value = PLAYER_STATES.WALKING;
        
        const targetPosition = this.world.getComponent(entityId, MapComponents.TargetPosition);
        if (targetPosition) {
            targetPosition.x = targetPos.x;
            targetPosition.y = targetPos.y;
        } else {
            this.world.addComponent(entityId, new MapComponents.TargetPosition(targetPos.x, targetPos.y));
        }
    }
}