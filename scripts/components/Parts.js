/**
 * メダロットの構成パーツIDを保持するコンポーネント
 * 以前はオブジェクトそのものを保持していたが、パーツのEntity化に伴い、Entity IDを保持するように変更。
 */
export class Parts {
    /**
     * @param {number} head - 頭部パーツのEntity ID
     * @param {number} rightArm - 右腕パーツのEntity ID
     * @param {number} leftArm - 左腕パーツのEntity ID
     * @param {number} legs - 脚部パーツのEntity ID
     */
    constructor(head, rightArm, leftArm, legs) {
        /** @type {number | null} */
        this.head = head;
        /** @type {number | null} */
        this.rightArm = rightArm;
        /** @type {number | null} */
        this.leftArm = leftArm;
        /** @type {number | null} */
        this.legs = legs;
    }
}