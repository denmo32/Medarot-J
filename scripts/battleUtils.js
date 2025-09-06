// scripts/battleUtils.js

// バトル関連のユーティリティ関数を集約
// 主要な関数は別ファイルに分割されました

// 再エクスポート: 後方互換性を保つため
export { calculateDamage, getParts, getAttackableParts, findBestDefensePart, getAllActionParts } from './utils/battleUtils.js';
export { determineTarget, getValidEnemies } from './ai/targetingUtils.js';
export { targetingStrategies, isValidTarget } from './ai/targetingStrategies.js';
