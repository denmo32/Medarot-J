/**
 * @file MapUIManager.js
 * @description マップシーンのUI要素（メニュー、メッセージウィンドウ）のDOM操作を担当するクラス。
 */
export class MapUIManager {
    constructor() {
        this.dom = {
            menu: document.getElementById('map-menu'),
            interactionWindow: document.getElementById('interaction-message-window'),
            confirmBattleButton: document.getElementById('confirm-battle-button'),
            cancelBattleButton: document.getElementById('cancel-battle-button'),
            // メニューボタン群
            saveButton: document.querySelector('.map-menu-button[data-action="save"]'),
            medarotchiButton: document.querySelector('.map-menu-button[data-action="medarotchi"]'),
        };

        // メニューのフォーカス順序を管理
        this.menuButtons = [this.dom.medarotchiButton, this.dom.saveButton].filter(btn => btn);
    }

    // --- Menu Control ---

    showMenu() {
        if (this.dom.menu) {
            this.dom.menu.classList.remove('hidden');
        }
    }

    hideMenu() {
        if (this.dom.menu) {
            this.dom.menu.classList.add('hidden');
        }
    }

    updateMenuFocus(index) {
        this.menuButtons.forEach(btn => btn.classList.remove('focused'));
        const button = this.menuButtons[index];
        if (button) {
            button.focus();
            button.classList.add('focused');
        }
    }

    getMenuButtonCount() {
        return this.menuButtons.length;
    }

    triggerMenuButton(index) {
        const button = this.menuButtons[index];
        if (button) {
            button.click();
        }
    }

    bindMenuAction(action, handler) {
        let targetBtn;
        if (action === 'save') targetBtn = this.dom.saveButton;
        if (action === 'medarotchi') targetBtn = this.dom.medarotchiButton;

        if (targetBtn && handler) {
            // 重複登録防止のため一度cloneするか、リスナー管理が必要だが、
            // シンプルに「ハンドラをプロパティで保持して上書き」する手もある。
            // ここではremoveEventListener対応のため、管理はSystem側に任せるか、
            // 「前回登録したものを削除」するロジックを入れる。
            // 簡易実装として、DOM要素を再取得（cloneNode）してリセットする手法をとる。
            const newBtn = targetBtn.cloneNode(true);
            targetBtn.parentNode.replaceChild(newBtn, targetBtn);
            
            if (action === 'save') this.dom.saveButton = newBtn;
            if (action === 'medarotchi') this.dom.medarotchiButton = newBtn;

            // リストも更新
            this.menuButtons = [this.dom.medarotchiButton, this.dom.saveButton].filter(btn => btn);

            newBtn.addEventListener('click', handler);
        }
    }

    // --- Interaction Window Control ---

    showInteractionWindow() {
        if (this.dom.interactionWindow) {
            this.dom.interactionWindow.classList.remove('hidden');
            this.dom.confirmBattleButton.focus();
        }
    }

    hideInteractionWindow() {
        if (this.dom.interactionWindow) {
            this.dom.interactionWindow.classList.add('hidden');
        }
    }

    bindInteractionActions(onConfirm, onCancel) {
        // メニュー同様、リスナーのリセットを行う
        const resetBtn = (btnId) => {
            const btn = document.getElementById(btnId);
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            return newBtn;
        };

        this.dom.confirmBattleButton = resetBtn('confirm-battle-button');
        this.dom.cancelBattleButton = resetBtn('cancel-battle-button');

        if (onConfirm) this.dom.confirmBattleButton.addEventListener('click', onConfirm);
        if (onCancel) this.dom.cancelBattleButton.addEventListener('click', onCancel);
    }
    
    focusConfirmButton() {
        this.dom.confirmBattleButton?.focus();
    }
    
    focusCancelButton() {
        this.dom.cancelBattleButton?.focus();
    }
    
    clickActiveButton() {
        if (document.activeElement instanceof HTMLButtonElement) {
            document.activeElement.click();
        } else {
            this.dom.confirmBattleButton?.click();
        }
    }

    clickCancelButton() {
        this.dom.cancelBattleButton?.click();
    }
}