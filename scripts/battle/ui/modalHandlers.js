/**
 * @file modalHandlers.js
 * @description モーダルごとの挙動（入力ハンドリング）定義。
 * Viewロジック（DOM生成）を排除し、Controllerとしての責務に専念する。
 */
import { GameEvents } from '../../common/events.js';
import { ModalType } from '../common/constants.js';
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
 * @property {object} data
 * @property {object} uiState
 * @property {string|null} focusedButtonKey
 * @property {Function} emit
 * @property {Function} close
 * @property {Function} proceed
 * @property {Function} updateTargetHighlight
 * @property {Function} setButtonFocus
 * @property {Function} triggerButtonClick
 */

export const modalHandlers = {
    [ModalType.START_CONFIRM]: {
        getActorName: () => 'ロボトルを開始しますか？',
        // createContent は削除
    },
    [ModalType.SELECTION]: {
        getOwnerName: (data) => data.ownerName,
        
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
            
            if (initialFocusKey) {
                // 自分自身のhandleNavigationを呼び出してハイライト処理等を共有
                modalHandlers[ModalType.SELECTION].handleNavigation(ctx, initialFocusKey);
                ctx.setButtonFocus(initialFocusKey, true);
                
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