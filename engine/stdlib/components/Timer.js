/**
 * @file Timer Component
 * @description 標準ライブラリ: タイマーコンポーネント
 */
export class Timer {
    /**
     * @param {number} duration - タイマーの持続時間（ミリ秒）
     * @param {Function} onComplete - コールバック関数
     */
    constructor(duration, onComplete) {
        this.duration = duration;
        this.onComplete = onComplete;
    }
}