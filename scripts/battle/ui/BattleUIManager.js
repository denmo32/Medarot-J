/**
 * @file BattleUIManager.js
 * @description バトルシーン固有のUI要素のDOM操作を担当するクラス。
 * DOM生成ロジック（View）を集約。
 */
import { el } from '../../../../engine/utils/DOMUtils.js';
import { ModalType } from '../common/constants.js';
import { PartInfo } from '../../common/constants.js';
import { GameEvents } from '../../common/events.js';

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
    }

    updatePanelText(ownerName, title, actorName) {
        this.dom.actionPanelOwner.textContent = ownerName || '';
        this.dom.actionPanelTitle.textContent = title || '';
        this.dom.actionPanelActor.innerHTML = actorName || '';
    }

    clearButtons() {
        this.dom.actionPanelButtons.innerHTML = '';
    }

    /**
     * モーダルタイプに応じたコンテンツ（ボタン等）を描画する
     * @param {string} modalType 
     * @param {object} data - ボタン描画用のデータ
     * @param {object} context - イベント発行用のコンテキスト
     */
    renderContent(modalType, data, context) {
        this.clearButtons();
        let content = null;

        switch (modalType) {
            case ModalType.START_CONFIRM:
                content = this._renderStartConfirm(context);
                break;
            case ModalType.SELECTION:
                content = this._renderSelection(data, context);
                break;
            // 他のタイプで特定のボタン表示が必要な場合はここに追加
        }

        if (content) {
            this.dom.actionPanelButtons.appendChild(content);
        }
    }

    _renderStartConfirm(context) {
        return el('div', { className: 'buttons-center' }, [
            el('button', {
                textContent: 'OK',
                className: 'action-panel-button',
                onclick: () => context.emit(GameEvents.GAME_START_CONFIRMED)
            }),
            el('button', {
                textContent: 'キャンセル',
                className: 'action-panel-button bg-red-500 hover:bg-red-600',
                onclick: () => context.emit(GameEvents.HIDE_MODAL)
            })
        ]);
    }

    _renderSelection(data, context) {
        const buttonsData = data; // dataが直接buttonsData配列
        const getBtnData = (key) => buttonsData.find(b => b.partKey === key);
        const headBtnData = getBtnData(PartInfo.HEAD.key);
        const rArmBtnData = getBtnData(PartInfo.RIGHT_ARM.key);
        const lArmBtnData = getBtnData(PartInfo.LEFT_ARM.key);

        const createButton = (btnData) => {
            if (!btnData) {
                return el('div', { style: { width: '100px', height: '35px' } });
            }

            const attributes = {
                id: `panelBtn-${btnData.partKey}`,
                className: 'part-action-button',
                textContent: btnData.text,
                'data-key': btnData.partKey // クリックイベントで識別するため
            };

            if (btnData.isBroken) {
                attributes.disabled = true;
            }
            // onclick は削除
            return el('button', attributes);
        };

        return el('div', { className: 'triangle-layout' }, [
            el('div', { className: 'top-row' }, createButton(headBtnData)),
            el('div', { className: 'bottom-row' }, [
                createButton(rArmBtnData),
                createButton(lArmBtnData)
            ])
        ]);
    }
    
    showPanel() {
        this.dom.actionPanel.classList.remove('hidden');
    }

    hidePanel() {
        this.dom.actionPanel.classList.add('hidden');
    }

    setPanelClickable(isClickable) {
        this.dom.actionPanel.classList.toggle('clickable', isClickable);
    }

    showIndicator() {
        this.dom.actionPanelIndicator.classList.remove('hidden');
    }

    hideIndicator() {
        this.dom.actionPanelIndicator.classList.add('hidden');
    }

    resetPanel() {
        this.updatePanelText('', '', '待機中...');
        this.clearButtons();
        this.hideIndicator();
        this.setPanelClickable(false);
    }
    
    updateAllButtonFocus(focusedKey) {
        const buttons = this.dom.actionPanelButtons.querySelectorAll('button');
        buttons.forEach(button => {
            const key = button.dataset.key;
            button.classList.toggle('focused', key === focusedKey);
        });
    }
}