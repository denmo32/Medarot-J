/**
 * @file BattleUIState.js
 * @description バトルシーンのUI状態（モーダル、メッセージフロー）を管理するシングルトンコンポーнент。
 * System内部に状態を持たせず、ここに集約することでECSの原則に従う。
 */

export class BattleUIState {
    constructor() {
        this.modalQueue = []; // reset()の前に必ずキューを初期化する
        this.reset();
    }

    /**
     * 状態をリセットします
     */
    reset() {
        // --- 状態管理 ---
        // this.modalQueue = []; // キューはモーダル終了時にリセットしない
        /** @type {boolean} キュー処理中フラグ */
        this.isProcessingQueue = false;
        /** @type {boolean} アニメーション待機中フラグ */
        this.isWaitingForAnimation = false;

        // --- 現在のモーダル情報 ---
        /** @type {string|null} 現在表示中のモーダルタイプ */
        this.currentModalType = null;
        /** @type {object|null} 現在表示中のモーダルデータ */
        this.currentModalData = null;
        /** @type {string|null} 現在実行中のタスクID（タスク経由で表示された場合） */
        this.currentTaskId = null;
        /** @type {Function|null} モーダル完了時のコールバック */
        this.currentModalCallback = null;
        /** @type {string|null} 現在フォーカスされているボタンのキー */
        this.focusedButtonKey = null;

        // --- メッセージシーケンス管理 ---
        /** @type {Array} 現在のメッセージシーケンス */
        this.currentMessageSequence = [];
        /** @type {number} 現在のシーケンスインデックス */
        this.currentSequenceIndex = 0;
        
        // --- 描画用データ (ModalSystemが更新し、ActionPanelSystemが参照する) ---
        this.ownerText = '';
        this.titleText = '';
        this.actorText = '';
        this.buttonsData = [];
        this.isPanelVisible = false;
        this.isPanelClickable = false;
    }
}