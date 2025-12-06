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

export const createModalHandlers = (systemInstance) => ({
    [ModalType.START_CONFIRM]: {
        getActorName: () => 'ロボトルを開始しますか？',
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
    [ModalType.SELECTION]: {
        getOwnerName: (data) => data.ownerName,
        createContent: (system, data) => {
            const buttonsData = data.buttons;
            const getBtnData = (key) => buttonsData.find(b => b.partKey === key);
            const headBtnData = getBtnData(PartInfo.HEAD.key);
            const rArmBtnData = getBtnData(PartInfo.RIGHT_ARM.key);
            const lArmBtnData = getBtnData(PartInfo.LEFT_ARM.key);

            const updateTargetHighlight = (partKey, show) => {
                const buttonData = getBtnData(partKey);
                if (!buttonData || !buttonData.target || buttonData.target.targetId === null) return;
                
                // engineUIManager を使用してターゲットインジケータを操作
                const targetDom = system.engineUIManager.getDOMElements(buttonData.target.targetId);
                if (targetDom?.targetIndicatorElement) {
                    targetDom.targetIndicatorElement.classList.toggle('active', show);
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
        handleNavigation: (system, key) => {
            const _updateTargetHighlight = (partKey, show) => {
                const buttonData = system.currentModalData?.buttons.find(b => b.partKey === partKey);
                if (!buttonData || !buttonData.target || buttonData.target.targetId === null) return;

                const targetDom = system.engineUIManager.getDOMElements(buttonData.target.targetId);
                if (targetDom?.targetIndicatorElement) {
                     targetDom.targetIndicatorElement.classList.toggle('active', show);
                }
            };

            const updateFocus = (newKey) => {
                if (system.focusedButtonKey === newKey) return;
                
                if (system.focusedButtonKey) {
                    _updateTargetHighlight(system.focusedButtonKey, false);
                    system.battleUI.setButtonFocus(system.focusedButtonKey, false);
                }
                
                _updateTargetHighlight(newKey, true);
                // ボタンの存在確認は BattleUIManager 側で行う
                system.battleUI.setButtonFocus(newKey, true);
                
                // system.battleUI.setButtonFocus は DOM要素がない場合何もしないので、
                // 実際にフォーカスが当たったかどうかを確認するには、DOMを参照するか、
                // ロジックを信頼してキー更新を行う。ここでは後者。
                // ただし、ボタンが無効化されている場合などの考慮が必要であれば調整する。
                system.focusedButtonKey = newKey;
            };

            const availableButtons = system.currentModalData?.buttons.filter(b => !b.isBroken);
            if (!availableButtons || availableButtons.length === 0) return;

            if (!system.focusedButtonKey) {
                const defaultKey = availableButtons.find(b => b.partKey === PartInfo.HEAD.key)?.partKey || availableButtons[0].partKey;
                updateFocus(defaultKey);
                return;
            }

            const candidates = NAVIGATION_MAP[system.focusedButtonKey]?.[key];
            if (candidates) {
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
            system.battleUI.triggerButtonClick(system.focusedButtonKey);
        },
        init: (system, data) => {
            const available = data.buttons.filter(b => !b.isBroken);
            const initialFocusKey = available.find(b => b.partKey === PartInfo.HEAD.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.RIGHT_ARM.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.LEFT_ARM.key)?.partKey;
            if (initialFocusKey) setTimeout(() => system.currentHandler.handleNavigation(system, initialFocusKey), 0);
        }
    },
    [ModalType.ATTACK_DECLARATION]: {
        getActorName: (data) => data.currentMessage?.text || '',
        isClickable: true,
        handleConfirm: (system, data) => {
            system.proceedToNextSequence();
        }
    },
    [ModalType.EXECUTION_RESULT]: {
        getActorName: (data) => data.currentMessage?.text || '',
        isClickable: true,
        handleConfirm: (system, data) => {
            system.proceedToNextSequence();
        }
    },
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