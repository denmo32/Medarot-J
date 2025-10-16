// バトルフィールド上の位置
export class Position {
    /**
     * @param {number} x - X軸位置 (0 to 1 ratio)
     * @param {number} y - Y軸位置 (v-pos in %)
     */
    constructor(x, y) {
        /** @type {number} */
        this.x = x; // 0 to 1 ratio
        /** @type {number} */
        this.y = y; // v-pos in %
    }
}