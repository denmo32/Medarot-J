/**
 * @file Events.js
 * @description ECSベースのイベント、リクエスト、タグコンポーネントを定義します。
 * 以前のGameEventsに対応する通知を、データ駆動形式で行うためのコンポーネント群です。
 */

/**
 * @class HpChangedEvent
 * @description HPが変化したことを示すイベントコンポーネント。
 * このコンポーネントは、UI更新やログ出力などの副作用処理のために使用されます。
 */
export class HpChangedEvent {
    constructor(payload) {
        /**
         * @property {number} entityId - HPが変化したパーツを持つエンティティID
         * @property {string} partKey - 対象パーツキー (例: 'head', 'rightArm', 'leftArm'など)
         * @property {number} newHp - 新しいHP値
         * @property {number} oldHp - 変更前のHP値
         * @property {number} maxHp - 最大HP値
         * @property {number} change - HPの変化量 (負の場合は減少、正の場合は増加)
         * @property {boolean} isHeal - 回復かどうかを表すフラグ
         */
        this.entityId = payload.entityId;
        this.partKey = payload.partKey;
        this.newHp = payload.newHp;
        this.oldHp = payload.oldHp;
        this.maxHp = payload.maxHp;
        this.change = payload.change;
        this.isHeal = payload.isHeal;
    }
}

/**
 * @class PartBrokenEvent
 * @description パーツが破壊されたことを示すイベントコンポーネント。
 */
export class PartBrokenEvent {
    constructor(payload) {
        /**
         * @property {number} entityId - 破壊されたパーツを持つエンティティID
         * @property {string} partKey - 破壊されたパーツキー
         */
        this.entityId = payload.entityId;
        this.partKey = payload.partKey;
    }
}

/**
 * @class BattleStartConfirmedRequest
 * @description バトル開始が確定したことを示すリクエストコンポーネント。
 * BattleFlowSystemなどによって処理され、その後に削除されます。
 */
export class BattleStartConfirmedRequest {
    constructor() {
        // データ不要、存在することで「バトル開始要求」を意味する
    }
}

/**
 * @class HideModalRequest
 * @description モーダルを非表示にすることを要求するリクエストコンポーネント。
 * UI系のシステムで処理され、削除されます。
 */
export class HideModalRequest {
    constructor() {
        // データ不要、存在することで「モーダルを隠す要求」を意味する
    }
}

/**
 * @class ActionCancelledRequest
 * @description アクションがキャンセルされたことを示すリクエストコンポーネント。
 * 主にGLITCHなどでキャンセルされた場合に使用されます。
 */
export class ActionCancelledRequest {
    constructor(payload) {
        /**
         * @property {number} entityId - キャンセルされたアクションのエンティティID
         * @property {string} reason - キャンセル理由 (例: 'INTERRUPTED'など)
         */
        this.entityId = payload.entityId;
        this.reason = payload.reason;
    }
}

/**
 * @class BattleStartCancelledRequest
 * @description バトル開始がキャンセルされたことを示すリクエストコンポーネント。
 * BattleFlowSystemなどによって処理され、その後に削除されます。
 */
export class BattleStartCancelledRequest {
    constructor() {
        // データ不要、存在することで「バトル開始キャンセル要求」を意味する
    }
}

/**
 * @class ResetButtonClickedRequest
 * @description リセットボタンが押されたことを示すリクエストコンポーネント。
 * BattleFlowSystemなどによって処理され、その後に削除されます。
 */
export class ResetButtonClickedRequest {
    constructor() {
        // データ不要、存在することで「リセット要求」を意味する
    }
}

/**
 * @class PartSelectedRequest
 * @description パーツが選択されたことを示すリクエストコンポーネント。
 * 主にUIから入力を受け取った際に使用されます。
 */
export class PartSelectedRequest {
    constructor(payload) {
        /**
         * @property {number} entityId - 選択されたパーツを持つエンティティID
         * @property {string} partKey - 選択されたパーツキー
         * @property {any} target - 選択時のターゲット情報
         */
        this.entityId = payload.entityId;
        this.partKey = payload.partKey;
        this.target = payload.target;
    }
}