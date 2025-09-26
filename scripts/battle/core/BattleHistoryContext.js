/**
 * @file BattleHistoryContext Component
 * @description Manages battle history and related data for AI personalities.
 * This singleton component separates the concern of battle history management from the main GameContext.
 * It is intended to be used by systems that need to track past actions for AI logic or other game mechanics.
 */
import { TeamID } from '../common/constants.js';

export class BattleHistoryContext {
    constructor() {
        // Tracks the last attack made by each team (for Assist personality)
        this.teamLastAttack = {
            [TeamID.TEAM1]: { targetId: null, partKey: null },
            [TeamID.TEAM2]: { targetId: null, partKey: null }
        };
        // Tracks the last enemy that attacked each team's leader (for Guard personality)
        this.leaderLastAttackedBy = {
            [TeamID.TEAM1]: null,
            [TeamID.TEAM2]: null
        };
    }
}