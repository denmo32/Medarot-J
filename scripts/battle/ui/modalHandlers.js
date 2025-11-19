/**
 * @file アクションパネルのモーダルハンドラ定義
 * ActionPanelSystemが使用する、各モーダルタイプの具体的な振る舞いを定義します。
 * これにより、ActionPanelSystemの責務を「管理」に集中させ、
 * 各モーダルの「内容」をこのファイルで一元管理します。
 * 
 * リファクタリング: HTML文字列ではなくDOM APIを使用して要素を生成するように変更しました。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { ModalType, PartInfo, PartKeyToInfoMap, EffectScope } from '../common/constants.js';

/**
 * ActionPanelSystemのインスタンスをコンテキストとして受け取り、
 * モーダルハンドラのオブジェクトを生成します。
 * @param {ActionPanelSystem} systemInstance - ActionPanelSystemのインスタンス
 * @returns {object} モーダルハンドラのコレクション
 */
export const createModalHandlers = (systemInstance) => ({
    // --- スタート確認 ---
    [ModalType.START_CONFIRM]: {
        getActorName: () => 'ロボトルを開始しますか？',
        /**
         * コンテンツDOMを生成します。
         * @param {ActionPanelSystem} system
         * @returns {HTMLElement}
         */
        createContent: (system) => {
            const container = document.createElement('div');
            container.className = 'buttons-center';

            const btnYes = document.createElement('button');
            btnYes.textContent = 'OK';
            btnYes.className = 'action-panel-button';
            btnYes.onclick = () => {
                system.world.emit(GameEvents.GAME_START_CONFIRMED);
                system.hideActionPanel();
            };

            const btnNo = document.createElement('button');
            btnNo.textContent = 'キャンセル';
            btnNo.className = 'action-panel-button bg-red-500 hover:bg-red-600';
            btnNo.onclick = () => system.hideActionPanel();

            container.appendChild(btnYes);
            container.appendChild(btnNo);
            return container;
        }
    },
    // --- 行動選択 ---
    [ModalType.SELECTION]: {
        getOwnerName: (data) => data.ownerName,
        /**
         * 行動選択ボタンのDOMを三角レイアウトで生成します。
         * @param {ActionPanelSystem} system
         * @param {object} data
         * @returns {HTMLElement}
         */
        createContent: (system, data) => {
            const buttonsData = data.buttons;
            const headBtnData = buttonsData.find(b => b.partKey === PartInfo.HEAD.key);
            const rArmBtnData = buttonsData.find(b => b.partKey === PartInfo.RIGHT_ARM.key);
            const lArmBtnData = buttonsData.find(b => b.partKey === PartInfo.LEFT_ARM.key);

            const wrapper = document.createElement('div');
            wrapper.className = 'triangle-layout';

            const topRow = document.createElement('div');
            topRow.className = 'top-row';
            const bottomRow = document.createElement('div');
            bottomRow.className = 'bottom-row';

            // ヘルパー関数: ターゲットハイライト更新
            const updateTargetHighlight = (partKey, show) => {
                const buttonData = buttonsData.find(b => b.partKey === partKey);
                if (!buttonData || !buttonData.target || buttonData.target.targetId === null) return;
                
                const targetDom = system.uiManager.getDOMElements(buttonData.target.targetId);
                if (targetDom?.targetIndicatorElement) {
                    targetDom.targetIndicatorElement.classList.toggle('active', show);
                }
            };

            // ヘルパー関数: ボタン生成
            const createButton = (btnData) => {
                if (!btnData) {
                    const placeholder = document.createElement('div');
                    placeholder.style.width = '100px';
                    placeholder.style.height = '35px';
                    return placeholder;
                }

                const button = document.createElement('button');
                button.id = `panelBtn-${btnData.partKey}`; // フォーカス制御用にIDは残す
                button.className = 'part-action-button';
                button.textContent = btnData.text;
                
                if (btnData.isBroken) {
                    button.disabled = true;
                } else {
                    button.onclick = () => {
                        system.world.emit(GameEvents.PART_SELECTED, {
                            entityId: data.entityId,
                            partKey: btnData.partKey,
                            target: btnData.target,
                        });
                        system.hideActionPanel();
                    };

                    if (btnData.target) {
                        button.onmouseover = () => updateTargetHighlight(btnData.partKey, true);
                        button.onmouseout = () => updateTargetHighlight(btnData.partKey, false);
                    }
                }
                return button;
            };

            topRow.appendChild(createButton(headBtnData));
            bottomRow.appendChild(createButton(rArmBtnData));
            bottomRow.appendChild(createButton(lArmBtnData));

            wrapper.appendChild(topRow);
            wrapper.appendChild(bottomRow);
            return wrapper;
        },
        /**
         * 方向キーによるフォーカス移動を処理します。
         * @param {ActionPanelSystem} system - ActionPanelSystemのインスタンス
         * @param {string} key - 押されたキー ('arrowup', 'arrowdown', etc.)
         */
        handleNavigation: (system, key) => {
            const _updateTargetHighlight = (partKey, show) => {
                const buttonData = system.currentModalData?.buttons.find(b => b.partKey === partKey);
                if (!buttonData || !buttonData.target || buttonData.target.targetId === null) return;

                const targetDom = system.uiManager.getDOMElements(buttonData.target.targetId);
                if (targetDom?.targetIndicatorElement) {
                     targetDom.targetIndicatorElement.classList.toggle('active', show);
                }
            };

            const updateFocus = (newKey) => {
                if (system.focusedButtonKey === newKey) return;
                // 古いフォーカスとハイライトを解除
                if (system.focusedButtonKey) {
                    _updateTargetHighlight(system.focusedButtonKey, false);
                    const oldButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${system.focusedButtonKey}`);
                    if (oldButton) oldButton.classList.remove('focused');
                }
                // 新しいフォーカスとハイライトを設定
                _updateTargetHighlight(newKey, true);
                const newButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${newKey}`);
                if (newButton) {
                    newButton.classList.add('focused');
                    system.focusedButtonKey = newKey;
                } else {
                    system.focusedButtonKey = null;
                }
            };

            const availableButtons = system.currentModalData?.buttons.filter(b => !b.isBroken);
            if (!availableButtons || availableButtons.length === 0) return;
            let nextFocusKey = system.focusedButtonKey;
            const has = (partKey) => availableButtons.some(b => b.partKey === partKey);
            switch (system.focusedButtonKey) {
                case PartInfo.HEAD.key:
                    if (key === 'arrowdown' || key === 'arrowleft') nextFocusKey = has(PartInfo.RIGHT_ARM.key) ? PartInfo.RIGHT_ARM.key : PartInfo.LEFT_ARM.key;
                    else if (key === 'arrowright') nextFocusKey = has(PartInfo.LEFT_ARM.key) ? PartInfo.LEFT_ARM.key : PartInfo.RIGHT_ARM.key;
                    break;
                case PartInfo.RIGHT_ARM.key:
                    if (key === 'arrowup') nextFocusKey = has(PartInfo.HEAD.key) ? PartInfo.HEAD.key : null;
                    else if (key === 'arrowright') nextFocusKey = has(PartInfo.LEFT_ARM.key) ? PartInfo.LEFT_ARM.key : null;
                    break;
                case PartInfo.LEFT_ARM.key:
                    if (key === 'arrowup') nextFocusKey = has(PartInfo.HEAD.key) ? PartInfo.HEAD.key : null;
                    else if (key === 'arrowleft') nextFocusKey = has(PartInfo.RIGHT_ARM.key) ? PartInfo.RIGHT_ARM.key : null;
                    break;
                default: nextFocusKey = availableButtons.find(b => b.partKey === PartInfo.HEAD.key)?.partKey || availableButtons[0]?.partKey;
            }
            if (nextFocusKey) updateFocus(nextFocusKey);
        },
        /**
         * 決定キー（Zキー）が押されたときに、フォーカス中のボタンをクリックします。
         * @param {ActionPanelSystem} system - ActionPanelSystemのインスタンス
         */
        handleConfirm: (system) => {
            if (!system.focusedButtonKey) return;
            const focusedButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${system.focusedButtonKey}`);
            if (focusedButton && !focusedButton.disabled) focusedButton.click();
        },
        /**
         * モーダル表示時に初期フォーカスを設定します。
         * @param {ActionPanelSystem} system - ActionPanelSystemのインスタンス
         * @param {object} data - モーダルデータ
         */
        init: (system, data) => {
            const available = data.buttons.filter(b => !b.isBroken);
            const initialFocusKey = available.find(b => b.partKey === PartInfo.HEAD.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.RIGHT_ARM.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.LEFT_ARM.key)?.partKey;
            if (initialFocusKey) setTimeout(() => system.currentHandler.handleNavigation(system, initialFocusKey), 0);
        }
    },
    // --- 攻撃宣言 ---
    [ModalType.ATTACK_DECLARATION]: {
        getActorName: (data) => data.currentMessage?.text || '',
        isClickable: true,
        handleConfirm: (system, data) => {
            system.proceedToNextSequence();
        }
    },
    // --- 結果表示 ---
    [ModalType.EXECUTION_RESULT]: {
        getActorName: (data) => data.currentMessage?.text || '',
        isClickable: true,
        handleConfirm: (system, data) => {
            system.proceedToNextSequence();
        }
    },
    // --- バトル開始確認 ---
    [ModalType.BATTLE_START_CONFIRM]: {
        getActorName: () => '合意と見てよろしいですね！？',
        isClickable: true,
        handleConfirm: (system) => {
            system.world.emit(GameEvents.BATTLE_START_CONFIRMED, {});
            system.hideActionPanel();
        },
        handleCancel: (system) => {
            system.world.emit(GameEvents.BATTLE_START_CANCELLED, {});
            system.hideActionPanel();
        }
    },
    // ---汎用メッセージ ---
    [ModalType.MESSAGE]: {
        getActorName: (data) => data?.currentMessage?.text || data?.message || '',
        isClickable: true,
        handleConfirm: (system) => {
            if (system.currentMessageSequence && system.currentMessageSequence.length > 1) {
                system.proceedToNextSequence();
            } else {
                system.hideActionPanel();
            }
        },
    },
    // --- ゲームオーバー ---
    [ModalType.GAME_OVER]: {
        getTitle: (data) => `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
        getActorName: () => 'ロボトル終了！',
        isClickable: true,
        handleConfirm: (system) => {
            system.world.emit(GameEvents.RESET_BUTTON_CLICKED);
            system.hideActionPanel();
        }
    }
});