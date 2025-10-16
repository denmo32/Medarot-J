import { CONFIG } from '../../common/config.js';

// ゲージ
export class Gauge {
    constructor() {
        /** @type {number} */
        this.value = 0;
        /** @type {number} */
        this.speedMultiplier = 1.0; // ★新規: パーツ性能に応じた速度補正率
        // speedプロパティは廃止され、GaugeSystemが直接脚部の推進力を参照する
        /** @type {number} */
        this.max = CONFIG.MAX_GAUGE;
    }
}