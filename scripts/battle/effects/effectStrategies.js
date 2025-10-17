/**
 * @file アクション効果戦略定義 (インデックス)
 * このファイルは、各カテゴリの効果戦略ファイルをインポートし、
 * 単一の`effectStrategies`オブジェクトとしてエクスポートする責務を持ちます。
 * これにより、ActionSystemは単一の参照先を維持しつつ、
 * 各効果ロジックのファイル分割を可能にし、保守性を向上させます。
 */
import { hpEffects } from './hpEffects.js';
import { statusEffects } from './statusEffects.js';

/**
 * アクション効果戦略のコレクション。
 * 個別の効果ファイルからインポートした戦略を一つのオブジェクトに統合します。
 */
export const effectStrategies = {
    ...hpEffects,
    ...statusEffects,
};