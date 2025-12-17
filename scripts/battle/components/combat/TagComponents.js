/**
 * @file TagComponents.js
 * @description 戦闘アクションの特性を表すタグコンポーネント群。
 * scripts/battle/components/combat/ 配下に配置
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