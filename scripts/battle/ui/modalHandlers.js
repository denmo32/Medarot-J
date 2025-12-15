/**
 * @file modalHandlers.js
 * @description モーダルごとの挙動（入力ハンドリング）定義。
 * AiDecisionServiceのインターフェース変更に対応（world引数の追加）。
 */
import { GameEvents } from '../../common/events.js';
import { ModalType } from '../common/constants.js';
import { PartInfo } from '../../common/constants.js';
import { CONFIG } from '../common/config.js';
import { AiDecisionService } from '../services/AiDecisionService.js';
import { QueryService } from '../services/QueryService.js';
import { PlayerInfo } from '../../components/index.js';

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
 * @property {object} data - モーダルの元データ
 * @property {object} uiState - 現在のBattleUIState
 */

export const modalHandlers = {
    [ModalType.START_CONFIRM]: {
        getActorName: () => 'ロボトルを開始しますか？',
    },
    [ModalType.SELECTION]: {
        prepareData: ({ world, data: detail, services }) => {
            const { entityId } = detail;
            const playerInfo = world.getComponent(entityId, PlayerInfo);
            if (!playerInfo) return null;

            const { aiService } = services;

            // 純粋関数呼び出しに変更し、worldを渡す
            const targetCandidates = aiService.getSuggestionForPlayer(world, entityId);

            if (!targetCandidates || targetCandidates.length === 0) {
                return null; // ターゲット候補がいない場合はモーダルを出さない
            }

            const actionPlans = aiService.generateActionPlans(world, entityId, targetCandidates);
            const allPossibleParts = QueryService.getAllActionParts(world, entityId);

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
                eventName: GameEvents.PART_SELECTED, 
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
        handleConfirm: () => ({ action: 'EMIT_AND_CLOSE', eventName: GameEvents.BATTLE_START_CONFIRMED }),
        handleCancel: () => ({ action: 'EMIT_AND_CLOSE', eventName: GameEvents.BATTLE_START_CANCELLED })
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
        handleConfirm: () => ({ action: 'EMIT_AND_CLOSE', eventName: GameEvents.RESET_BUTTON_CLICKED })
    }
};