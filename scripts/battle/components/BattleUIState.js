/**
 * @file BattleUIState.js
 * @description バトルシーンのUI状態（モーダル、メッセージフロー）を管理するシングルトンコンポーネント。
 * System内部に状態を持たせず、ここに集約することでECSの原則に従う。
 */

export class BattleUIState {
    constructor() {
        /** @type {Array} 待機中のモーダルリクエストキュー */
        this.modalQueue = [];
        
        /** @type {string|null} 現在表示中のモーダルタイプ */
        this.currentModalType = null;
        
        /** @type {object|null} 現在表示中のモーダルデータ */
        this.currentModalData = null;
        
        /** @type {string|null} 現在実行中のタスクID（タスク経由で表示された場合） */
        this.currentTaskId = null;
        
        /** @type {Array} 現在のメッセージシーケンス */
        this.currentMessageSequence = [];
        
        /** @type {number} 現在のシーケンスインデックス */
        this.currentSequenceIndex = 0;
        
        /** @type {boolean} アニメーション待機中フラグ */
        this.isWaitingForAnimation = false;
        
        /** @type {boolean} キュー処理中フラグ */
        this.isProcessingQueue = false;

        /** @type {string|null} 現在フォーカスされているボタンのキー */
        this.focusedButtonKey = null;
    }

    /**
     * 状態をリセットします
     */
    reset() {
        this.modalQueue = [];
        this.currentModalType = null;
        this.currentModalData = null;
        this.currentTaskId = null;
        this.currentMessageSequence = [];
        this.currentSequenceIndex = 0;
        this.isWaitingForAnimation = false;
        this.isProcessingQueue = false;
        this.focusedButtonKey = null;
    }
}