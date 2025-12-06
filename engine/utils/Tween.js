/**
 * @file 数値補間ユーティリティ
 * @description オブジェクトのプロパティを時間の経過とともに変化させます。
 */
export class Tween {
    /**
     * @param {object} params
     * @param {object} params.target - 変更対象のオブジェクト
     * @param {string} params.property - 変更するプロパティ名
     * @param {number} params.start - 開始値
     * @param {number} params.end - 終了値
     * @param {number} params.duration - 所要時間 (ms)
     * @param {Function} [params.easing] - イージング関数 (t => t)
     * @param {Function} [params.onComplete] - 完了時のコールバック
     */
    constructor({ target, property, start, end, duration, easing, onComplete }) {
        this.target = target;
        this.property = property;
        this.start = start;
        this.end = end;
        this.duration = duration;
        this.elapsed = 0;
        this.easing = easing || ((t) => t);
        this.onComplete = onComplete;
        this.isFinished = false;
    }

    /**
     * 時間経過による更新
     * @param {number} dt - 経過時間 (ms)
     */
    update(dt) {
        this.elapsed += dt;
        const progress = Math.min(this.elapsed / this.duration, 1.0);
        const t = this.easing(progress);
        
        this.target[this.property] = this.start + (this.end - this.start) * t;

        if (progress >= 1.0) {
            this.isFinished = true;
            if (this.onComplete) this.onComplete();
        }
    }
}