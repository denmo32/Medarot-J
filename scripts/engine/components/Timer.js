/**
 * @file Timer Component
 * @description 時間ベースのイベントを管理するためのコンポーネント。
 * 指定された時間が経過した後にコールバックを実行します。
 * setTimeoutの代わりにECSのライフサイクル内で動作するため、テストや状態管理が容易になります。
 */
export class Timer {
    /**
     * @param {number} duration - タイマーの持続時間（ミリ秒）
     * @param {Function} onComplete - タイマー完了時に実行されるコールバック関数
     */
    constructor(duration, onComplete) {
        /** @type {number} */
        this.duration = duration;
        /** @type {Function} */
        this.onComplete = onComplete;
    }
}