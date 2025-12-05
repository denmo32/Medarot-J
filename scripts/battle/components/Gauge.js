import { CONFIG } from '../common/config.js';

// ゲージ
export class Gauge {
    constructor() {
        /** @type {number} */
        this.value = 0;
        /** @type {number} */
        this.speedMultiplier = 1.0; 
        /** @type {number} */
        this.max = CONFIG.MAX_GAUGE;
        /** @type {number} */
        this.currentSpeed = 0; 

        // ゲージが加算される状態かどうかを制御するフラグ
        /** @type {boolean} */
        this.isActive = false;
    }
}