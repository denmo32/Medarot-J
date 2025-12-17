/**
 * @file TagComponents.js
 * @description 戦闘システムにおける各種状態や特性を表すタグコンポーネント群。
 * Enumによる状態管理を廃止し、これらのコンポーネントの有無で状態を定義する。
 */

// --- アクション種別タグ ---
export class IsShootingAction { constructor() {} }
export class IsMeleeAction { constructor() {} }
export class IsSupportAction { constructor() {} }
export class IsHealAction { constructor() {} }
export class IsDefendAction { constructor() {} }
export class IsInterruptAction { constructor() {} }

// --- ターゲット制御タグ ---
export class RequiresPreMoveTargeting { constructor() {} }
export class RequiresPostMoveTargeting { constructor() {} }
export class TargetResolved { constructor() {} } // ターゲット解決済みフラグ

// --- 効果特性タグ ---
export class HasDamageEffect { constructor() {} }
export class HasHealEffect { constructor() {} }
export class PenetratesGuard { constructor() {} }

// --- プレイヤー/エンティティ状態タグ (GameState代替) ---
/** コマンド選択待ち（スタートライン待機中） */
export class IsReadyToSelect { constructor() {} }

/** アクション実行待ち（アクションライン待機中） */
export class IsReadyToExecute { constructor() {} }

/** チャージ中（アクションラインへ移動中） */
export class IsCharging { constructor() {} }

/** クールダウン中（スタートラインへ帰還中） */
export class IsCooldown { constructor() {} }

/** ガード中（アクションラインで防御態勢） */
export class IsGuarding { constructor() {} }

/** 機能停止 */
export class IsBroken { constructor() {} }

/** 演出待ち（アクション処理開始後、アニメーション再生待ちなど） */
export class IsAwaitingAnimation { constructor() {} }


// --- 戦闘シーケンスフェーズタグ (BattleSequenceState代替) ---
/** 計算フェーズ実行中 */
export class InCombatCalculation { constructor() {} }

/** 演出生成フェーズ実行中 */
export class GeneratingVisuals { constructor() {} }

/** 演出実行フェーズ実行中 */
export class ExecutingVisuals { constructor() {} }

/** シーケンス完了 */
export class SequenceFinished { constructor() {} }