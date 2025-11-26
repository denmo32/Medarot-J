import { System } from '../../../engine/core/System.js';
import * as MapComponents from '../components.js';
import { CONFIG } from '../constants.js';
import { clamp } from '../../../engine/utils/MathUtils.js';

export class CameraSystem extends System {
    constructor(world, camera, map) {
        super(world);
        this.camera = camera;
        this.map = map;
        this.playerEntityId = null;
    }

    _findPlayer() {
        if (this.playerEntityId === null) {
            const players = this.getEntities(MapComponents.PlayerControllable);
            if (players.length > 0) {
                this.playerEntityId = players[0];
            }
        }
        return this.playerEntityId;
    }

    update(deltaTime) {
        const playerEntityId = this._findPlayer();
        if (playerEntityId === null) return;

        const playerPosition = this.world.getComponent(playerEntityId, MapComponents.Position);
        if (!playerPosition) return;

        let targetX = playerPosition.x + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_WIDTH / 2);
        let targetY = playerPosition.y + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_HEIGHT / 2);

        this.camera.x = clamp(targetX, 0, this.map.widthPx - CONFIG.VIEWPORT_WIDTH);
        this.camera.y = clamp(targetY, 0, this.map.heightPx - CONFIG.VIEWPORT_HEIGHT);
    }
}