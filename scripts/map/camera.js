// camera.js
import { CONFIG } from './constants.js';
import * as MapComponents from './components.js';

export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
    }

    /**
     * カメラの位置を更新する
     * @param {World} world - ECSワールド
     * @param {number} playerEntityId - プレイヤーエンティティのID
     * @param {Map} map - マップオブジェクト
     */
    update(world, playerEntityId, map) {
        const playerPosition = world.getComponent(playerEntityId, MapComponents.Position);
        if (!playerPosition) return;

        // プレイヤーが画面中央に来るようにカメラの座標を計算
        this.x = playerPosition.x + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_WIDTH / 2);
        this.y = playerPosition.y + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_HEIGHT / 2);

        // カメラがマップの範囲外に出ないようにクランプ（座標制限）する
        this.x = Math.max(0, Math.min(this.x, map.widthPx - CONFIG.VIEWPORT_WIDTH));
        this.y = Math.max(0, Math.min(this.y, map.heightPx - CONFIG.VIEWPORT_HEIGHT));
    }
}