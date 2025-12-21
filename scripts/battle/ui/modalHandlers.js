/**
 * @file modalHandlers.js
 * @description モーダルごとの挙動定義。
 * AiDecisionService -> AiLogic
 * ActionService -> BattleRequestFactory
 * QueryService -> BattleQueries
 */
import { ModalType } from '../common/constants.js';
import { PartInfo } from '../../common/constants.js';
import { CONFIG } from '../common/config.js';
import { AiLogic } from '../ai/AiLogic.js';
import { BattleRequestFactory } from '../utils/BattleRequestFactory.js';
import { BattleQueries } from '../queries/BattleQueries.js';
import { PlayerInfo } from '../../components/index.js';
import { PartSelectedRequest, BattleStartConfirmedRequest, BattleStartCancelledRequest, ResetButtonClickedRequest } from '../../components/Events.js';

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

export const modalHandlers = {
    [ModalType.START_CONFIRM]: {
        getActorName: () => 'ロボトルを開始しますか？',
    },
    [ModalType.SELECTION]: {
        prepareData: ({ world, data: detail, services }) => {
            const { entityId } = detail;
            const playerInfo = world.getComponent(entityId, PlayerInfo);
            if (!playerInfo) return null;

            // services.aiService is replaced by direct AiLogic import
            const targetCandidates = AiLogic.getSuggestionForPlayer(world, entityId);

            if (!targetCandidates || targetCandidates.length === 0) {
                return null;
            }

            const actionPlans = AiLogic.generateActionPlans(world, entityId, targetCandidates);
            const allPossibleParts = BattleQueries.getAllActionParts(world, entityId);

            const buttonsData = allPossibleParts.map(([partKey, part]) => {
                const plan = actionPlans.find(p => p.partKey === partKey);
                return {
                    text: `${part.name} (${part.type})`,
                    partKey: partKey,
                    isBroken: part.isBroken,
                    target: plan ? plan.target : null
                };
            });

            return {
                entityId,
                ownerName: playerInfo.name,
                buttons: buttonsData
            };
        },

        getOwnerName: (data) => data.ownerName,
        
        init: ({ data }) => {
            const available = data.buttons.filter(b => !b.isBroken);
            const initialFocusKey = available.find(b => b.partKey === PartInfo.HEAD.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.RIGHT_ARM.key)?.partKey ||
                                    available.find(b => b.partKey === PartInfo.LEFT_ARM.key)?.partKey;
            
            return { action: 'UPDATE_FOCUS', key: initialFocusKey };
        },

        handleNavigation: ({ data, uiState }, direction) => {
            const availableButtons = data.buttons.filter(b => !b.isBroken);
            if (!availableButtons || availableButtons.length === 0) return null;

            let currentFocus = uiState.focusedButtonKey;

            if (!currentFocus) {
                const defaultKey = availableButtons[0].partKey;
                return { action: 'UPDATE_FOCUS', key: defaultKey };
            }

            const candidates = NAVIGATION_MAP[currentFocus]?.[direction];
            if (candidates) {
                const nextKey = candidates.find(candidateKey => 
                    availableButtons.some(b => b.partKey === candidateKey)
                );
                if (nextKey) {
                    return { action: 'UPDATE_FOCUS', key: nextKey };
                }
            }
            return null;
        },
        
        handleConfirm: ({ data, uiState }) => {
            if (!uiState.focusedButtonKey) return null;

            const buttonData = data.buttons.find(b => b.partKey === uiState.focusedButtonKey);
            if (!buttonData) return null;
            
            return {
                action: 'EMIT_AND_CLOSE',
                eventName: 'PART_SELECTED',
                detail: {
                    entityId: data.entityId,
                    partKey: buttonData.partKey,
                    target: buttonData.target,
                }
            };
        },
    },
    [ModalType.ATTACK_DECLARATION]: {
        isClickable: true,
        handleConfirm: () => ({ action: 'PROCEED_SEQUENCE' })
    },
    [ModalType.EXECUTION_RESULT]: {
        isClickable: true,
        handleConfirm: () => ({ action: 'PROCEED_SEQUENCE' })
    },
    [ModalType.BATTLE_START_CONFIRM]: {
        isClickable: true,
        getActorName: () => '合意と見てよろしいですね！？',
        handleConfirm: () => ({ action: 'EMIT_AND_CLOSE', eventName: 'BATTLE_START_CONFIRMED' }),
        handleCancel: () => ({ action: 'EMIT_AND_CLOSE', eventName: 'BATTLE_START_CANCELLED' })
    },
    [ModalType.MESSAGE]: {
        isClickable: true,
        handleConfirm: ({ uiState }) => {
            if (uiState.currentMessageSequence && uiState.currentMessageSequence.length > 1) {
                return { action: 'PROCEED_SEQUENCE' };
            } else {
                return { action: 'CLOSE_MODAL' };
            }
        },
    },
    [ModalType.GAME_OVER]: {
        isClickable: true,
        getTitle: (data) => `${CONFIG.TEAMS[data.winningTeam].name} の勝利！`,
        getActorName: () => 'ロボトル終了！',
        handleConfirm: () => ({ action: 'EMIT_AND_CLOSE', eventName: 'RESET_BUTTON_CLICKED' })
    }
};