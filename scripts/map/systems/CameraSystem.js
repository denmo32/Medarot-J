import { BaseSystem } from '../../core/baseSystem.js';
import * as MapComponents from '../components.js';
import { CONFIG } from '../constants.js';

export class CameraSystem extends BaseSystem {
    constructor(world, camera, map) {
        super(world);
        this.camera = camera;
        this.map = map;
        this.playerEntityId = null;
    }

    _findPlayer() {
        if (this.playerEntityId === null) {
            const players = this.world.getEntitiesWith(MapComponents.PlayerControllable);
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

        this.camera.x = playerPosition.x + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_WIDTH / 2);
        this.camera.y = playerPosition.y + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_HEIGHT / 2);

        this.camera.x = Math.max(0, Math.min(this.camera.x, this.map.widthPx - CONFIG.VIEWPORT_WIDTH));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.map.heightPx - CONFIG.VIEWPORT_HEIGHT));
    }
}
