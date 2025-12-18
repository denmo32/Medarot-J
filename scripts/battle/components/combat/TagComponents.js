/**
 * @file TagComponents.js
 * @description 戦闘システムにおける各種状態や特性を表すタグコンポーネント群。
 * 一括管理用のタググループ定義を追加。
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

// --- プレイヤー/エンティティ状態タグ ---
export class IsReadyToSelect { constructor() {} }
export class IsReadyToExecute { constructor() {} }
export class IsCharging { constructor() {} }
export class IsCooldown { constructor() {} }
export class IsGuarding { constructor() {} }
export class IsBroken { constructor() {} }
export class IsAwaitingAnimation { constructor() {} }

// --- 戦闘シーケンスフェーズタグ ---
/** 計算フェーズ実行中（ターゲット解決、命中判定） */
export class InCombatCalculation { constructor() {} }

/** エフェクト処理待ち（子エフェクトエンティティの完了待ち） */
export class ProcessingEffects { constructor() {} }

/** 演出生成フェーズ実行中 */
export class GeneratingVisuals { constructor() {} }

/** 演出実行フェーズ実行中 */
export class ExecutingVisuals { constructor() {} }

/** シーケンス完了 */
export class SequenceFinished { constructor() {} }

// --- Tag Groups (Helper for Systems) ---
export const ActionTypeTags = [
    IsShootingAction, IsMeleeAction, IsSupportAction, 
    IsHealAction, IsDefendAction, IsInterruptAction
];

export const TargetingTags = [
    RequiresPreMoveTargeting, RequiresPostMoveTargeting, TargetResolved
];

export const SequencePhaseTags = [
    InCombatCalculation, ProcessingEffects, GeneratingVisuals, ExecutingVisuals
];

export const PlayerStateTags = [
    IsReadyToSelect, IsReadyToExecute, IsCharging, IsCooldown, 
    IsGuarding, IsBroken, IsAwaitingAnimation
];