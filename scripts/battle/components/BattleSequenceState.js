/**
 * @file BattleSequenceState.js
 * @description アクション実行シーケンス中の個々のエンティティの状態を管理するコンポーネント。
 * システムの内部状態(Map)を廃止し、ECSのエンティティに状態を持たせるために使用する。
 */

export const SequenceState = {
    IDLE: 'IDLE',
    REQUEST_COMBAT: 'REQUEST_COMBAT',
    WAITING_COMBAT: 'WAITING_COMBAT',
    REQUEST_VISUALS: 'REQUEST_VISUALS',
    WAITING_VISUALS: 'WAITING_VISUALS',
    EXECUTING_TASKS: 'EXECUTING_TASKS',
    COMPLETED: 'COMPLETED'
};

export class BattleSequenceState {
    constructor() {
        /** @type {string} 現在のシーケンス状態 */
        this.currentState = SequenceState.IDLE;
        
        /** @type {object|null} シーケンス間で保持する必要があるコンテキストデータ (旧 lastResultData) */
        this.contextData = null;
    }
}