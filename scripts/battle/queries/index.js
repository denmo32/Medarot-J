/**
 * @file index.js
 * @description 戦闘関連クエリのエントリポイント。
 * ドメインごとに分割されたクエリを統合して提供します。
 */

import * as PartQueries from './PartQueries.js';
import * as EntityQueries from './BattleEntityQueries.js';
import * as TargetingQueries from './BattleTargetingQueries.js';

// 各機能の個別エクスポート
export * from './PartQueries.js';
export * from './BattleEntityQueries.js';
export * from './BattleTargetingQueries.js';

/**
 * 後方互換性のための統合オブジェクト。
 * 既存の BattleQueries.method() 形式の呼び出しをサポートします。
 */
export const BattleQueries = {
    ...PartQueries,
    ...EntityQueries,
    ...TargetingQueries
};
