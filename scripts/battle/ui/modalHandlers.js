/**
 * @file アクションパネルのモーダルハンドラ定義
 * ActionPanelSystemが使用する、各モーダルタイプの具体的な振る舞いを定義します。
 * DOM構築ユーティリティ 'el' を使用して、UI生成コードを簡潔に保ちます。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { ModalType, PartInfo } from '../common/constants.js';
import { el } from '../../engine/utils/domUtils.js';

// ナビゲーションルール定義
// 現在のフォーカス位置(key)と入力キー(direction)に対し、
// 次にフォーカスすべき候補の優先順位リストを定義します。
const NAVIGATION_MAP = {
    [PartInfo.HEAD.key]: {
        arrowdown: [PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key],
        arrowleft: [PartInfo.LEFT_ARM.key, PartInfo.RIGHT_ARM.key],
        arrowright: [PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key],
    },
    [PartInfo.RIGHT_ARM.key]: {
        arrowup: [PartInfo.HEAD.key],
        arrowleft: [PartInfo.LEFT_ARM.key],
        arrowright: [PartInfo.LEFT_ARM.key], // ループ動作として左腕へ
    },
    [PartInfo.LEFT_ARM.key]: {
        arrowup: [PartInfo.HEAD.key],
        arrowleft: [PartInfo.RIGHT_ARM.key], // ループ動作として右腕へ
        arrowright: [PartInfo.RIGHT_ARM.key],
    }
};

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
            return el('div', { className: 'buttons-center' }, [
                el('button', {
                    textContent: 'OK',
                    className: 'action-panel-button',
                    onclick: () => {
                        system.world.emit(GameEvents.GAME_START_CONFIRMED);
                        system.hideActionPanel();
                    }
                }),
                el('button', {
                    textContent: 'キャンセル',
                    className: 'action-panel-button bg-red-500 hover:bg-red-600',
                    onclick: () => system.hideActionPanel()
                })
            ]);
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
            // ボタンデータの検索を簡略化
            const getBtnData = (key) => buttonsData.find(b => b.partKey === key);
            const headBtnData = getBtnData(PartInfo.HEAD.key);
            const rArmBtnData = getBtnData(PartInfo.RIGHT_ARM.key);
            const lArmBtnData = getBtnData(PartInfo.LEFT_ARM.key);

            // ヘルパー関数: ターゲットハイライト更新
            const updateTargetHighlight = (partKey, show) => {
                const buttonData = getBtnData(partKey);
                if (!buttonData || !buttonData.target || buttonData.target.targetId === null) return;
                
                const targetDom = system.uiManager.getDOMElements(buttonData.target.targetId);
                if (targetDom?.targetIndicatorElement) {
                    targetDom.targetIndicatorElement.classList.toggle('active', show);
                }
            };

            // ヘルパー関数: ボタン生成
            const createButton = (btnData) => {
                if (!btnData) {
                    // データがない場合はスペース用の空divを返す
                    return el('div', { style: { width: '100px', height: '35px' } });
                }

                // 属性オブジェクトの構築
                const attributes = {
                    id: `panelBtn-${btnData.partKey}`,
                    className: 'part-action-button',
                    textContent: btnData.text
                };

                if (btnData.isBroken) {
                    attributes.disabled = true;
                } else {
                    attributes.onclick = () => {
                        system.world.emit(GameEvents.PART_SELECTED, {
                            entityId: data.entityId,
                            partKey: btnData.partKey,
                            target: btnData.target,
                        });
                        system.hideActionPanel();
                    };

                    if (btnData.target) {
                        attributes.onmouseover = () => updateTargetHighlight(btnData.partKey, true);
                        attributes.onmouseout = () => updateTargetHighlight(btnData.partKey, false);
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
        },
        /**
         * 方向キーによるフォーカス移動を処理します。
         * ナビゲーションマップを使用して、次にフォーカスすべきボタンを決定します。
         * @param {ActionPanelSystem} system - ActionPanelSystemのインスタンス
         * @param {string} key - 押されたキー ('arrowup', 'arrowdown', etc.)
         */
        handleNavigation: (system, key) => {
            // ヘルパー: ターゲットハイライト更新
            const _updateTargetHighlight = (partKey, show) => {
                const buttonData = system.currentModalData?.buttons.find(b => b.partKey === partKey);
                if (!buttonData || !buttonData.target || buttonData.target.targetId === null) return;

                const targetDom = system.uiManager.getDOMElements(buttonData.target.targetId);
                if (targetDom?.targetIndicatorElement) {
                     targetDom.targetIndicatorElement.classList.toggle('active', show);
                }
            };

            // ヘルパー: フォーカスとハイライトの切り替え
            const updateFocus = (newKey) => {
                if (system.focusedButtonKey === newKey) return;
                
                // 古いフォーカス解除
                if (system.focusedButtonKey) {
                    _updateTargetHighlight(system.focusedButtonKey, false);
                    const oldButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${system.focusedButtonKey}`);
                    if (oldButton) oldButton.classList.remove('focused');
                }
                
                // 新しいフォーカス設定
                _updateTargetHighlight(newKey, true);
                const newButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${newKey}`);
                if (newButton) {
                    newButton.classList.add('focused');
                    system.focusedButtonKey = newKey;
                } else {
                    system.focusedButtonKey = null;
                }
            };

            // 利用可能な（破壊されていない）ボタンのみを対象とする
            const availableButtons = system.currentModalData?.buttons.filter(b => !b.isBroken);
            if (!availableButtons || availableButtons.length === 0) return;

            // 現在のフォーカスがない場合はデフォルト（頭部または最初の利用可能パーツ）を設定
            if (!system.focusedButtonKey) {
                const defaultKey = availableButtons.find(b => b.partKey === PartInfo.HEAD.key)?.partKey || availableButtons[0].partKey;
                updateFocus(defaultKey);
                return;
            }

            // ナビゲーションマップに基づいて次の候補を探す
            const candidates = NAVIGATION_MAP[system.focusedButtonKey]?.[key];
            if (candidates) {
                // 候補の中から、実際に利用可能な最初のパーツを選択
                const nextKey = candidates.find(candidateKey => 
                    availableButtons.some(b => b.partKey === candidateKey)
                );
                
                if (nextKey) {
                    updateFocus(nextKey);
                }
            }
        },
        handleConfirm: (system) => {
            if (!system.focusedButtonKey) return;
            const focusedButton = system.dom.actionPanelButtons.querySelector(`#panelBtn-${system.focusedButtonKey}`);
            if (focusedButton && !focusedButton.disabled) focusedButton.click();
        },
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
