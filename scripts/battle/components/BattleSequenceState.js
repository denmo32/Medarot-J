/**
 * @file BattleSequenceState.js
 * @description バトルアクション実行パイプラインのコンテキストデータを保持するコンポーネント。
 * 状態遷移ロジック（currentState）は削除され、TagComponentsによって管理される。
 */

export class BattleSequenceState {
    constructor() {
        /** @type {object|null} パイプライン間で共有するコンテキストデータ (計算結果、キャンセル理由など) */
        this.contextData = null;
    }
}