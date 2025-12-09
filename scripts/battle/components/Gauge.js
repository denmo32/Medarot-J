import { CONFIG } from '../common/config.js';

// ゲージ
export class Gauge {
    /**
     * @param {string} [type='ACTION'] - ゲージの種類 ('ACTION', 'MEDAFORCE' など)
     * @param {number} [max=CONFIG.MAX_GAUGE] - 最大値
     */
    constructor(type = 'ACTION', max = CONFIG.MAX_GAUGE) {
        /** @type {string} */
        this.type = type;
        /** @type {number} */
        this.value = 0;
        /** @type {number} */
        this.speedMultiplier = 1.0; 
        /** @type {number} */
        this.max = max;
        /** @type {number} */
        this.currentSpeed = 0; 

        // ゲージが加算される状態かどうかを制御するフラグ
        /** @type {boolean} */
        this.isActive = false;

        // 一時的なロックや強制停止などの状態を保持する
        /** @type {Set<string>} */
        this.statusFlags = new Set();
    }

    /**
     * ゲージが強制停止状態か判定する
     * @returns {boolean}
     */
    isFrozen() {
        return this.statusFlags.has('FROZEN') || this.statusFlags.has('STOPPED');
    }
}