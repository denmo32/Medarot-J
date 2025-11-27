// パーツ情報
export class Parts {
    /**
     * @param {object} head - 頭部パーツのマスターデータ
     * @param {object} rightArm - 右腕パーツのマスターデータ
     * @param {object} leftArm - 左腕パーツのマスターデータ
     * @param {object} legs - 脚部パーツのマスターデータ
     */
    constructor(head, rightArm, leftArm, legs) {
        /** @type {object | null} */
        this.head = head;
        /** @type {object | null} */
        this.rightArm = rightArm;
        /** @type {object | null} */
        this.leftArm = leftArm;
        /** @type {object | null} */
        this.legs = legs;
    }
}