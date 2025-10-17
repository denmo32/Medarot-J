import { CONFIG } from '../../common/config.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID, TargetTiming } from '../../common/constants.js';

// パーツ情報
export class Parts {
    /**
     * @param {object} head - 頭部パーツのマスターデータ
     * @param {object} rightArm - 右腕パーツのマスターデータ
     * @param {object} leftArm - 左腕パーツのマスターデータ
     * @param {object} legs - 脚部パーツのマスターデータ
     */
    constructor(head, rightArm, leftArm, legs) {
        // ★リファクタリング: このコンポーネントは純粋なデータコンテナとしての責務に集中します。
        // パーツデータの初期化（ロールのマージなど）ロジックは、エンティティを生成する
        // entityFactory に移管されました。
        // これにより、コンポーネントは渡されたデータを保持するだけのシンプルな構造になります。

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