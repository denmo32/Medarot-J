/**
 * @file modalHandlers.js
 * @description モーダルごとの表示内容と挙動定義。
 * Systemへの直接依存を排除し、コンテキストオブジェクトを通じて操作を行う。
 */
import { GameEvents } from '../../common/events.js';
import { ModalType } from '../common/constants.js';
import { el } from '../../../engine/utils/DOMUtils.js';
import { PartInfo } from '../../common/constants.js';
import { CONFIG } from '../common/config.js';

const NAVIGATION_MAP = {
    [PartInfo.HEAD.key]: {
        arrowdown: [PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key],
        arrowleft: [PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key],
        arrowright: [PartInfo.LEFT_ARM.key, PartInfo.RIGHT_ARM.key],
    },
    [PartInfo.RIGHT_ARM.key]: {
        arrowup: [PartInfo.HEAD.key],
        arrowleft: [PartInfo.LEFT_ARM.key],
        arrowright: [PartInfo.LEFT_ARM.key],
    },
    [PartInfo.LEFT_ARM.key]: {
        arrowup: [PartInfo.HEAD.key],
        arrowleft: [PartInfo.RIGHT_ARM.key],
        arrowright: [PartInfo.RIGHT_ARM.key],
    }
};

/**
 * @typedef {object} ModalHandlerContext
 * @property {object} data - モーダルデータ
 * @property {object} uiState - 現在のUI状態
 * @property {string|null} focusedButtonKey - 現在フォーカスされているボタンキー
 * @property {Function} emit - イベント発行 (eventName, detail)
 * @property {Function} close - モーダルを閉じる
 * @property {Function} proceed - 次のシーケンスへ進む
 * @property {Function} updateTargetHighlight - ターゲットハイライト更新 (targetId, show)
 * @property {Function} setButtonFocus - ボタンフォーカス更新 (key, focused)
 * @property {Function} triggerButtonClick - ボタンクリック発火 (key)
 */

export const modalHandlers = {
    [ModalType.START_CONFIRM]: {
        getActorName: () => 'ロボトルを開始しますか？',
        /**
         * @param {ModalHandlerContext} ctx 
         */
        createContent: (ctx) => {
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
    },
    [ModalType.SELECTION]: {
        getOwnerName: (data) => data.ownerName,
        /**
         * @param {ModalHandlerContext} ctx 
         * @param {object} data 
         */
        createContent: (ctx, data) => {
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
        },
        /**
         * @param {ModalHandlerContext} ctx 
         * @param {string} key 
         */
        handleNavigation: (ctx, key) => {
            const _updateHighlight = (partKey, show) => {
                const buttonData = ctx.data?.buttons.find(b => b.partKey === partKey);
                if (buttonData?.target?.targetId) {
                    ctx.updateTargetHighlight(buttonData.target.targetId, show);
                }
            };

            const updateFocus = (newKey) => {
                if (ctx.focusedButtonKey === newKey) return;
                
                if (ctx.focusedButtonKey) {
                    _updateHighlight(ctx.focusedButtonKey, false);
                    ctx.setButtonFocus(ctx.focusedButtonKey, false);
                }
                
                _updateHighlight(newKey, true);
                ctx.setButtonFocus(newKey, true);
            };

            const availableButtons = ctx.data?.buttons.filter(b => !b.isBroken);
            if (!availableButtons || availableButtons.length === 0) return;

            if (!ctx.focusedButtonKey) {
                const defaultKey = availableButtons.find(b => b.partKey === PartInfo.HEAD.key)?.partKey || availableButtons[0].partKey;
                updateFocus(defaultKey);
                return;
            }

            const candidates = NAVIGATION_MAP[ctx.focusedButtonKey]?.[key];
            if (candidates) {
                const nextKey = candidates.find(candidateKey => 
                    availableButtons.some(b => b.partKey === candidateKey)
                );
                
                if (nextKey) {
                    updateFocus(nextKey);
                }
            }
        },
        /**
         * @param {ModalHandlerContext} ctx 
         */
        handleConfirm: (ctx) => {
            if (!ctx.focusedButtonKey) return;
            ctx.triggerButtonClick(ctx.focusedButtonKey);
        },
        /**
         * @param {ModalHandlerContext} ctx 
         * @param {object} data 
         */
        init: (ctx, data) => {
            const available = data.buttons.filter(b => !b.isBroken);
            const initialFocusKey = available.find(b => b.partKey === PartInfo.HEAD.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.RIGHT_ARM.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.LEFT_ARM.key)?.partKey;
            
            // 初期フォーカスの設定ロジックをNavigationハンドラに委譲
            // ここでは直接フォーカス設定を行わず、システム側で呼び出されることを期待するか、
            // コンテキスト経由で設定する
            if (initialFocusKey) {
                // setTimeoutはUI更新待ちのために必要だが、コンテキストからは隠蔽したい。
                // ただし、DOM構築直後である保証がないため、ここではロジックのみ示す。
                // 実際にはActionPanelSystem側でinit後にNavigationを呼ぶか、ctx.setButtonFocusを呼ぶ。
                // 互換性のためNavigationロジックを利用する
                
                // system.currentHandler.handleNavigation(system, initialFocusKey) 相当の処理
                // 自分自身のhandleNavigationを呼ぶ
                modalHandlers[ModalType.SELECTION].handleNavigation(ctx, initialFocusKey); // ダミーキーは不要だがロジック上 updateFocus が呼ばれるようにする
                
                // handleNavigationはキー入力を前提としているため、初期化用としては不適切かもしれない。
                // ここでは直接 ctx.setButtonFocus を呼ぶ方が適切。
                ctx.setButtonFocus(initialFocusKey, true);
                
                // 初期ハイライト
                const buttonData = data.buttons.find(b => b.partKey === initialFocusKey);
                if (buttonData?.target?.targetId) {
                    ctx.updateTargetHighlight(buttonData.target.targetId, true);
                }
            }
        }
    },
    [ModalType.ATTACK_DECLARATION]: {
        getActorName: (data) => data.currentMessage?.text || '',
        isClickable: true,
        handleConfirm: (ctx) => {
            ctx.proceed();
        }
    },
    [ModalType.EXECUTION_RESULT]: {
        getActorName: (data) => data.currentMessage?.text || '',
        isClickable: true,
        handleConfirm: (ctx) => {
            ctx.proceed();
        }
    },
    [ModalType.BATTLE_START_CONFIRM]: {
        getActorName: () => '合意と見てよろしいですね！？',
        isClickable: true,
        handleConfirm: (ctx) => {
            ctx.emit(GameEvents.BATTLE_START_CONFIRMED, {});
            ctx.close();
        },
        handleCancel: (ctx) => {
            ctx.emit(GameEvents.BATTLE_START_CANCELLED, {});
            ctx.close();
        }
    },
    [ModalType.MESSAGE]: {
        getActorName: (data) => data?.currentMessage?.text || data?.message || '',
        isClickable: true,
        handleConfirm: (ctx) => {
            if (ctx.uiState.currentMessageSequence && ctx.uiState.currentMessageSequence.length > 1) {
                ctx.proceed();
            } else {
                ctx.close();
            }
        },
    },
    [ModalType.GAME_OVER]: {
        getTitle: (data) => `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
        getActorName: () => 'ロボトル終了！',
        isClickable: true,
        handleConfirm: (ctx) => {
            ctx.emit(GameEvents.RESET_BUTTON_CLICKED);
            ctx.close();
        }
    }
};