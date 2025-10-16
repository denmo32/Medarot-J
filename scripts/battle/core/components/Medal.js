import { PlayerStateType, PartType, GamePhaseType, TeamID, TargetTiming } from '../../common/constants.js';

/**
 * メダルの情報を保持するコンポーネント
 */
export class Medal {
    /**
     * @param {string} personality - メダルの性格 (例: 'LEADER_FOCUS', 'RANDOM')
     */
    constructor(personality) {
        /** @type {string} */
        this.personality = personality;
    }
}