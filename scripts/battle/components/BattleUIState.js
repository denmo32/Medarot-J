/**
 * @file BattleUIState.js
 * @description バトルシーンのUI状態を管理するシングルトンコンポーネント。
 * Systemの内部状態（描画キャッシュ、アクティブID）もここに集約し、Systemのステートレス化を実現する。
 */

export class BattleUIState {
    constructor() {
        this.modalQueue = [];
        
        // --- 状態管理 ---
        this.isProcessingQueue = false;
        this.isWaitingForAnimation = false;

        // --- 現在のモーダル情報 ---
        this.activeModalEntityId = null; // 現在処理中のModalStateエンティティID
        this.currentModalType = null;
        this.currentModalData = null;
        this.currentTaskId = null;
        this.currentModalCallback = null;
        this.focusedButtonKey = null;

        // --- メッセージシーケンス管理 ---
        this.currentMessageSequence = [];
        this.currentSequenceIndex = 0;
        
        // --- 描画用データ (ModalSystem -> ActionPanelSystem) ---
        this.ownerText = '';
        this.titleText = '';
        this.actorText = '';
        this.buttonsData = [];
        this.isPanelVisible = false;
        this.isPanelClickable = false;
        
        // --- 描画キャッシュ (ActionPanelSystem用) ---
        // 前回の描画状態を保持し、変更がない場合のDOM操作を抑制する
        this.renderCache = {
            isPanelVisible: false,
            ownerText: '',
            titleText: '',
            actorText: '',
            modalType: null,
            buttonsSignature: '',
            isPanelClickable: false,
            isWaiting: false,
            focusedKey: null
        };
    }
}