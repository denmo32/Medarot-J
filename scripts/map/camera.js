// camera.js
import { CONFIG } from './constants.js';

export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
    }

    /**
     * カメラの位置を更新する
     * @param {object} player - プレイヤーオブジェクト
     * @param {Map} map - マップオブジェクト
     */
    update(player, map) {
        // プレイヤーが画面中央に来るようにカメラの座標を計算
        this.x = player.x + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_WIDTH / 2);
        this.y = player.y + (CONFIG.PLAYER_SIZE / 2) - (CONFIG.VIEWPORT_HEIGHT / 2);

        // カメラがマップの範囲外に出ないようにクランプ（座標制限）する
        this.x = Math.max(0, Math.min(this.x, map.widthPx - CONFIG.VIEWPORT_WIDTH));
        this.y = Math.max(0, Math.min(this.y, map.heightPx - CONFIG.VIEWPORT_HEIGHT));
    }
}