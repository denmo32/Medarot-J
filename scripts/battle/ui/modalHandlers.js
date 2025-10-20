/**
 * @file アクションパネルのモーダルハンドラ定義
 * ActionPanelSystemが使用する、各モーダルタイプの具体的な振る舞いを定義します。
 * これにより、ActionPanelSystemの責務を「管理」に集中させ、
 * 各モーダルの「内容」をこのファイルで一元管理します。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { ModalType, PartInfo, PartKeyToInfoMap, EffectType, EffectScope } from '../common/constants.js';

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
        getContentHTML: () => `
            <div class="buttons-center">
                <button id="panelBtnYes" class="action-panel-button">OK</button>
                <button id="panelBtnNo" class="action-panel-button bg-red-500 hover:bg-red-600">キャンセル</button>
            </div>`,
        setupEvents: (system, container) => {
            container.querySelector('#panelBtnYes').onclick = () => {
                system.world.emit(GameEvents.GAME_START_CONFIRMED);
                system.hideActionPanel();
            };
            container.querySelector('#panelBtnNo').onclick = () => system.hideActionPanel();
        }
    },
    // --- 行動選択 ---
    [ModalType.SELECTION]: {
        getOwnerName: (data) => data.ownerName,
        /**
         * 行動選択ボタンのHTMLを三角レイアウトで生成します。
         * @param {object} data - モーダルデータ
         * @returns {string} HTML文字列
         */
        getContentHTML: (data) => {
            const buttons = data.buttons;
            const headBtn = buttons.find(b => b.partKey === 'head');
            const rArmBtn = buttons.find(b => b.partKey === 'rightArm');
            const lArmBtn = buttons.find(b => b.partKey === 'leftArm');
            const renderButton = (btn) => {
                if (!btn) return '<div style="width: 100px; height: 35px;"></div>'; // プレースホルダー
                return `<button id="panelBtn-${btn.partKey}" class="part-action-button" ${btn.isBroken ? 'disabled' : ''}>${btn.text}</button>`;
            };
            return `
                <div class="triangle-layout">
                    <div class="top-row">${renderButton(headBtn)}</div>
                    <div class="bottom-row">${renderButton(rArmBtn)}${renderButton(lArmBtn)}</div>
                </div>`;
        },
        /**
         * 各ボタンにクリックイベントとマウスオーバーイベントを設定します。
         * @param {ActionPanelSystem} system - ActionPanelSystemのインスタンス
         * @param {HTMLElement} container - ボタンが配置されているコンテナ
         * @param {object} data - モーダルデータ
         */
        setupEvents: (system, container, data) => {
            const _updateTargetHighlight = (partKey, show) => {
                const buttonData = data.buttons.find(b => b.partKey === partKey);
                if (!buttonData || buttonData.targetTiming !== 'pre-move') return;
                const target = buttonData.target;
                if (target?.targetId !== null) {
                    const targetDom = system.uiManager.getDOMElements(target.targetId);
                    if (targetDom?.iconElement) {
                        targetDom.iconElement.style.boxShadow = show ? '0 0 15px cyan' : '';
                    }
                }
            };

            data.buttons.forEach(btnData => {
                if (btnData.isBroken) return;
                const buttonEl = container.querySelector(`#panelBtn-${btnData.partKey}`);
                if (!buttonEl) return;
        
                buttonEl.onclick = () => {
                    const target = btnData.target;
                    system.world.emit(GameEvents.PART_SELECTED, {
                        entityId: data.entityId,
                        partKey: btnData.partKey,
                        targetId: target?.targetId ?? null,
                        targetPartKey: target?.targetPartKey ?? null,
                    });
                    system.hideActionPanel();
                };
        
                if ([EffectScope.ENEMY_SINGLE, EffectScope.ALLY_SINGLE].includes(btnData.targetScope) && btnData.targetTiming === 'pre-move') {
                    buttonEl.onmouseover = () => _updateTargetHighlight(btnData.partKey, true);
                    buttonEl.onmouseout = () => _updateTargetHighlight(btnData.partKey, false);
                }
            });
        },
        /**
         * 方向キーによるフォーカス移動を処理します。
         * @param {ActionPanelSystem} system - ActionPanelSystemのインスタンス
         * @param {string} key - 押されたキー ('arrowup', 'arrowdown', etc.)
         */
        handleNavigation: (system, key) => {
            const _updateTargetHighlight = (partKey, show) => {
                const buttonData = system.currentModalData?.buttons.find(b => b.partKey === partKey);
                if (!buttonData || buttonData.targetTiming !== 'pre-move') return;
                const target = buttonData.target;
                if (target?.targetId !== null) {
                    const targetDom = system.uiManager.getDOMElements(target.targetId);
                    if (targetDom?.iconElement) {
                        targetDom.iconElement.style.boxShadow = show ? '0 0 15px cyan' : '';
                    }
                }
            };
            const updateFocus = (newKey) => {
                if (system.focusedButtonKey === newKey) return;
                if (system.focusedButtonKey) {
                    _updateTargetHighlight(system.focusedButtonKey, false);
                    const oldButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${system.focusedButtonKey}`);
                    if (oldButton) oldButton.classList.remove('focused');
                }
                _updateTargetHighlight(newKey, true);
                const newButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${newKey}`);
                if (newButton) {
                    newButton.classList.add('focused');
                    system.focusedButtonKey = newKey; // systemの状態を更新
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
            // setTimeoutでレンダリング後の実行を保証
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
            // [再修正] イベント名を 'BATTLE_START_CONFIRMED' に戻す
            system.world.emit('BATTLE_START_CONFIRMED', {});
            system.hideActionPanel();
        },
        handleCancel: (system) => {
            system.world.emit(GameEvents.BATTLE_START_CANCELLED, {});
            system.hideActionPanel();
        }
    },
    // ---汎用メッセージ ---
    [ModalType.MESSAGE]: {
        getActorName: (data) => data.message || '',
        isClickable: true,
        handleConfirm: (system) => system.hideActionPanel(),
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