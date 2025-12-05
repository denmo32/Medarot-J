/**
 * @file 効果適用ロジック インデックス
 * @description 各種効果（ダメージ、回復など）の適用ロジック（Applicator）を
 * 一つのマップに集約し、エクスポートする責務を持ちます。
 * これにより、ActionResolutionSystemは効果適用の詳細を知ることなく、
 * このマップを参照するだけでよくなります。
 */
import { applyDamage } from './damageApplicator.js';
import { applyHeal } from './healApplicator.js';
import { applyTeamEffect, applySelfEffect, consumeGuard } from './statusEffectApplicator.js';
import { applyGlitch } from './glitchApplicator.js';

// EffectTypeは共通定数として scripts/common/constants.js に定義されています。
// scripts/battle/effects/applicators/ -> ../../../common/constants.js
import { EffectType as CommonEffectType } from '../../../common/constants.js';

/**
 * 効果タイプと適用ロジックをマッピングしたオブジェクト。
 * ActionResolutionSystemがこのマップを利用して、適切な適用関数を呼び出します。
 */
export const effectApplicators = {
    [CommonEffectType.DAMAGE]: applyDamage,
    [CommonEffectType.HEAL]: applyHeal,
    [CommonEffectType.APPLY_SCAN]: applyTeamEffect,
    [CommonEffectType.APPLY_GUARD]: applySelfEffect,
    [CommonEffectType.APPLY_GLITCH]: applyGlitch,
    [CommonEffectType.CONSUME_GUARD]: consumeGuard,
};