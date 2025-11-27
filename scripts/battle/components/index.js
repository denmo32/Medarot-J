// 共通コンポーネントを再エクスポート（互換性維持）
export * from '../../components/index.js';

// 戦闘専用コンポーネント
export { Gauge } from './Gauge.js';
export { GameState } from './GameState.js';
export { Action } from './Action.js';
export { Position } from './Position.js';
export { BattleLog } from './BattleLog.js';
export { ActiveEffects } from './ActiveEffects.js';