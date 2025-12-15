/**
 * @file BattleSequenceState.js
 * @description バトルアクション実行パイプラインの状態を管理するコンポーネント。
 * エンティティはこのコンポーネントの状態遷移によって各システム間を受け渡される。
 */

export const SequenceState = {
    INITIALIZING: 'INITIALIZING',             // 初期化・ターゲット解決・キャンセル判定 (BattleSequenceSystem担当)
    CALCULATING: 'CALCULATING',               // ダメージ等の計算 (CombatSystem担当)
    GENERATING_VISUALS: 'GENERATING_VISUALS', // 演出データの生成 (VisualSequenceSystem担当)
    EXECUTING: 'EXECUTING',                   // 演出タスクの実行 (TaskSystem担当)
    FINISHED: 'FINISHED'                      // 完了・クリーンアップ待ち (BattleSequenceSystem担当)
};

export class BattleSequenceState {
    constructor() {
        /** @type {string} 現在のパイプライン工程 */
        this.currentState = SequenceState.INITIALIZING;
        
        /** @type {object|null} パイプライン間で共有するコンテキストデータ (計算結果、キャンセル理由など) */
        this.contextData = null;
    }
}