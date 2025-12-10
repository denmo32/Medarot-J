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

        this._currentClickListener = null;
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
     * @param {object} ctx - ModalHandlerContext (イベント発行用)
     * @param {object} data - モーダルデータ
     */
    renderContent(modalType, ctx, data) {
        this.clearButtons();
        let content = null;

        switch (modalType) {
            case ModalType.START_CONFIRM:
                content = this._renderStartConfirm(ctx);
                break;
            case ModalType.SELECTION:
                content = this._renderSelection(ctx, data);
                break;
            // 他のタイプで特定のボタン表示が必要な場合はここに追加
        }

        if (content) {
            this.dom.actionPanelButtons.appendChild(content);
        }
    }

    _renderStartConfirm(ctx) {
        return el('div', { className: 'buttons-center' }, [
            el('button', {
                textContent: 'OK',
                className: 'action-panel-button',
                onclick: () => {
                    ctx.emit(GameEvents.GAME_START_CONFIRMED);
                    ctx.close();
                }
            }),
            el('button', {
                textContent: 'キャンセル',
                className: 'action-panel-button bg-red-500 hover:bg-red-600',
                onclick: () => ctx.close()
            })
        ]);
    }

    _renderSelection(ctx, data) {
        const buttonsData = data.buttons;
        const getBtnData = (key) => buttonsData.find(b => b.partKey === key);
        const headBtnData = getBtnData(PartInfo.HEAD.key);
        const rArmBtnData = getBtnData(PartInfo.RIGHT_ARM.key);
        const lArmBtnData = getBtnData(PartInfo.LEFT_ARM.key);

        const updateHighlight = (partKey, show) => {
            const buttonData = getBtnData(partKey);
            if (buttonData?.target?.targetId) {
                ctx.updateTargetHighlight(buttonData.target.targetId, show);
            }
        };

        const createButton = (btnData) => {
            if (!btnData) {
                return el('div', { style: { width: '100px', height: '35px' } });
            }

            const attributes = {
                id: `panelBtn-${btnData.partKey}`,
                className: 'part-action-button',
                textContent: btnData.text
            };

            if (btnData.isBroken) {
                attributes.disabled = true;
            } else {
                attributes.onclick = () => {
                    ctx.emit(GameEvents.PART_SELECTED, {
                        entityId: data.entityId,
                        partKey: btnData.partKey,
                        target: btnData.target,
                    });
                    ctx.close();
                };

                if (btnData.target) {
                    attributes.onmouseover = () => updateHighlight(btnData.partKey, true);
                    attributes.onmouseout = () => updateHighlight(btnData.partKey, false);
                }
            }
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

    setPanelClickable(clickable) {
        if (clickable) {
            this.dom.actionPanel.classList.add('clickable');
        } else {
            this.dom.actionPanel.classList.remove('clickable');
        }
    }

    setPanelClickListener(callback) {
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
        this.setPanelClickListener(null);
    }

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

    triggerButtonClick(buttonKey) {
        const button = this.dom.actionPanelButtons.querySelector(`#panelBtn-${buttonKey}`);
        if (button && !button.disabled) {
            button.click();
        }
    }

    get buttonsContainer() {
        return this.dom.actionPanelButtons;
    }
}