/**
 * @file Requests.js
 * @description ECSの処理フロー制御用のリクエスト/結果/タグコンポーネント群。
 * イベントの代わりにこれらのコンポーネントを使用してシステム間でメッセージを伝達する。
 * 状態コンポーネントへの移行に伴い、一部コンポーネントは削除されました。
 */

export class CombatResult {
    constructor(data) {
        this.data = data;
    }
}

export class VisualSequence {
    constructor(tasks) {
        this.tasks = tasks;
    }
}

// --- 状態フラグ・タグ (イベント代替シグナル) ---

/** ゲージが満タンになったことを示すタグ */
export class GaugeFullTag { constructor() {} }

/** 戦闘開始アニメーションの再生要求 */
export class BattleStartAnimationRequest { constructor() {} }

/** 戦闘開始アニメーション完了通知 */
export class BattleStartAnimationCompleted { constructor() {} }

/** UIのリフレッシュ要求 */
export class RefreshUIRequest { constructor() {} }


/**
 * ターン終了シグナル
 * TurnSystemが発行し、EffectSystemなどが消費する
 */
export class TurnEndedSignal {
    constructor(turnNumber) {
        this.turnNumber = turnNumber;
    }
}


/** バトル開始確認の結果タグ */
export class BattleStartConfirmedTag { constructor() {} }
export class BattleStartCancelledTag { constructor() {} }

/** リセットボタン押下通知タグ */
export class ResetButtonResult { constructor() {} }

// --- イベント代替用データコンポーネント (Events as Data) ---

/**
 * HPが更新されたことを表すイベントデータ
 * ログ出力やデバッグ表示に使用される
 */
export class HpChangedEvent {
    constructor(entityId, partKey, change, isHeal, resultData) {
        this.entityId = entityId;
        this.partKey = partKey;
        this.change = change;
        this.isHeal = isHeal;
        this.resultData = resultData;
    }
}

/**
 * 効果が期限切れになったことを表すイベントデータ
 */
export class EffectExpiredEvent {
    constructor(entityId, effect) {
        this.entityId = entityId;
        this.effect = effect;
    }
}

/**
 * アクションがキャンセルされたことを表すイベントデータ
 */
export class ActionCancelledEvent {
    constructor(entityId, reason) {
        this.entityId = entityId;
        this.reason = reason;
    }
}

/**
 * プレイヤーが機能停止したことを表すイベントデータ
 */
export class PlayerBrokenEvent {
    constructor(entityId, teamId) {
        this.entityId = entityId;
        this.teamId = teamId;
    }
}

/**
 * AIが戦略を実行したことを表すイベントデータ (デバッグ用)
 */
export class StrategyExecutedEvent {
    constructor(strategy, attackerId, target) {
        this.strategy = strategy;
        this.attackerId = attackerId;
        this.target = target;
    }
}