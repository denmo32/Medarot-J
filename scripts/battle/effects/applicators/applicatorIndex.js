/**
 * @file 効果適用ロジック インデックス
 * @description 各種効果（ダメージ、回復など）の適用ロジック（Applicator）を
 * 一つのマップに集約し、エクスポートする責務を持ちます。
 * これにより、ActionResolutionSystemは効果適用の詳細を知ることなく、
 * このマップを参照するだけでよくなります。
 */
import { EffectType } from '../../common/constants.js';
import { applyDamage } from './damageApplicator.js';
import { applyHeal } from './healApplicator.js';
import { applyTeamEffect, applySelfEffect } from './statusEffectApplicator.js';
import { applyGlitch } from './glitchApplicator.js';

/**
 * 効果タイプと適用ロジックをマッピングしたオブジェクト。
 * ActionResolutionSystemがこのマップを利用して、適切な適用関数を呼び出します。
 */
export const effectApplicators = {
    [EffectType.DAMAGE]: applyDamage,
    [EffectType.HEAL]: applyHeal,
    [EffectType.APPLY_SCAN]: applyTeamEffect,
    [EffectType.APPLY_GUARD]: applySelfEffect,
    [EffectType.APPLY_GLITCH]: applyGlitch,
};