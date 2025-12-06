/**
 * @file BattleUIManager.js
 * @description バトルシーン固有のUI要素（主にアクションパネル）のDOM操作を担当するクラス。
 * ActionPanelSystemからViewロジックを分離。
 */
export class BattleUIManager {
    constructor() {
        this.dom = {
            actionPanel: document.getElementById('action-panel'),
            actionPanelOwner: document.getElementById('action-panel-owner'),
            actionPanelTitle: document.getElementById('action-panel-title'),
            actionPanelActor: document.getElementById('action-panel-actor'),
            actionPanelButtons: document.getElementById('action-panel-buttons'),
            actionPanelIndicator: document.getElementById('action-panel-indicator')
        };

        this._currentClickListener = null;
    }

    /**
     * パネルのテキスト情報を更新する
     * @param {string} ownerName オーナー名（左上）
     * @param {string} title タイトル（中央大）
     * @param {string} actorName アクター/メッセージ（中央小）
     */
    updatePanelText(ownerName, title, actorName) {
        this.dom.actionPanelOwner.textContent = ownerName || '';
        this.dom.actionPanelTitle.textContent = title || '';
        this.dom.actionPanelActor.innerHTML = actorName || '';
    }

    /**
     * ボタンエリアの内容をクリアする
     */
    clearButtons() {
        this.dom.actionPanelButtons.innerHTML = '';
    }

    /**
     * ボタンエリアにコンテンツを追加する
     * @param {HTMLElement} element 
     */
    addButtonContent(element) {
        this.dom.actionPanelButtons.appendChild(element);
    }

    /**
     * パネルのクリック可能状態を設定する
     * @param {boolean} clickable 
     */
    setPanelClickable(clickable) {
        if (clickable) {
            this.dom.actionPanel.classList.add('clickable');
        } else {
            this.dom.actionPanel.classList.remove('clickable');
        }
    }

    /**
     * パネルのクリックイベントリスナーを設定する
     * @param {Function} callback 
     */
    setPanelClickListener(callback) {
        // 既存のリスナーがあれば削除
        if (this._currentClickListener) {
            this.dom.actionPanel.removeEventListener('click', this._currentClickListener);
        }
        
        if (callback) {
            this._currentClickListener = callback;
            this.dom.actionPanel.addEventListener('click', callback);
        } else {
            this._currentClickListener = null;
        }
    }
    
    removePanelClickListener(callback) {
        if (callback) {
            this.dom.actionPanel.removeEventListener('click', callback);
        }
        this._currentClickListener = null;
    }

    /**
     * インジケーター（▼）を表示する
     */
    showIndicator() {
        this.dom.actionPanelIndicator.classList.remove('hidden');
    }

    /**
     * インジケーター（▼）を非表示にする
     */
    hideIndicator() {
        this.dom.actionPanelIndicator.classList.add('hidden');
    }

    /**
     * パネルの状態をリセットする（テキストクリア、ボタン削除、イベント解除）
     */
    resetPanel() {
        this.updatePanelText('', '', '待機中...');
        this.clearButtons();
        this.hideIndicator();
        this.setPanelClickable(false);
        this.setPanelClickListener(null);
    }

    /**
     * 指定されたキーを持つボタンのフォーカス状態を切り替える
     * @param {string} buttonKey 
     * @param {boolean} isFocused 
     */
    setButtonFocus(buttonKey, isFocused) {
        const button = this.dom.actionPanelButtons.querySelector(`#panelBtn-${buttonKey}`);
        if (button) {
            if (isFocused) {
                button.classList.add('focused');
            } else {
                button.classList.remove('focused');
            }
        }
    }

    /**
     * 指定されたキーを持つボタンをクリックする（プログラム的実行）
     * @param {string} buttonKey 
     */
    triggerButtonClick(buttonKey) {
        const button = this.dom.actionPanelButtons.querySelector(`#panelBtn-${buttonKey}`);
        if (button && !button.disabled) {
            button.click();
        }
    }

    /**
     * ボタンラッパー要素（.action-panel-buttons）自体への参照を取得
     */
    get buttonsContainer() {
        return this.dom.actionPanelButtons;
    }
}