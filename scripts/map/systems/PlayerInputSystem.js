import { System } from '../../../engine/core/System.js';
import { PlayerControllable } from '../../components/map/PlayerControllable.js';
import { State } from '../../components/map/State.js';
import { Position } from '../../components/map/Position.js';
import { Collision } from '../../components/map/Collision.js';
import { FacingDirection } from '../../components/map/FacingDirection.js';
import { TargetPosition } from '../../components/map/TargetPosition.js';
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
            PlayerControllable, 
            State, 
            Position,
            Collision
        );

        for (const entityId of entities) {
            this._handleMovement(entityId);

            if (this.input.wasKeyJustPressed('z')) {
                this.world.emit(GameEvents.INTERACTION_KEY_PRESSED, { entityId });
            }
        }
    }

    _handleMovement(entityId) {
        const state = this.world.getComponent(entityId, State);
        
        if (state.value !== PLAYER_STATES.IDLE || !this.input.direction) {
            return;
        }
        const direction = this.input.direction;
        this._updateFacingDirection(entityId, direction);
        this._tryMove(entityId, direction);
    }

    _tryMove(entityId, direction) {
        const position = this.world.getComponent(entityId, Position);
        const collision = this.world.getComponent(entityId, Collision);

        const targetPos = this._calculateTargetPosition(position, direction);

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

    _updateFacingDirection(entityId, direction) {
        const facingDirection = this.world.getComponent(entityId, FacingDirection);
        if (facingDirection) {
            facingDirection.direction = direction;
        } else {
            this.world.addComponent(entityId, new FacingDirection(direction));
        }
    }

    _applyMovement(entityId, targetPos) {
        const state = this.world.getComponent(entityId, State);
        state.value = PLAYER_STATES.WALKING;
        
        const targetPosition = this.world.getComponent(entityId, TargetPosition);
        if (targetPosition) {
            targetPosition.x = targetPos.x;
            targetPosition.y = targetPos.y;
        } else {
            this.world.addComponent(entityId, new TargetPosition(targetPos.x, targetPos.y));
        }
    }
}
