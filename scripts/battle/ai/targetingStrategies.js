/**
 * @file AIターゲティング戦略定義 (インデックス)
 * このファイルは、各カテゴリのターゲティング戦略ファイルをインポートし、
 * 単一の`targetingStrategies`オブジェクトとしてエクスポートする責務を持ちます。
 * これにより、AiSystemは単一の参照先を維持しつつ、
 * 各戦略ロジックのファイル分割を可能にし、保守性を向上させます。
 */
// 分割した戦略ファイルをインポート
import { offensiveStrategies } from './strategies/offensiveTargeting.js';
import { supportStrategies } from './strategies/supportTargeting.js';
import { postMoveStrategies } from './strategies/postMoveTargeting.js';
// 循環参照を避けるため、TargetingStrategyKey は strategyKeys.js から再エクスポートする
export { TargetingStrategyKey } from './strategyKeys.js';

/**
 * メダルの性格に基づいたターゲット決定戦略のコレクション。
 * 個別の戦略ファイルからインポートした戦略を一つのオブジェクトに統合します。
 */
export const targetingStrategies = {
    ...offensiveStrategies,
    ...supportStrategies,
    ...postMoveStrategies,
};