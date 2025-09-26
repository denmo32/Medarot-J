/**
 * @file BattlePhaseContext Component
 * @description Manages the battle phase state (e.g., IDLE, BATTLE, GAME_OVER).
 * This singleton component separates the concern of battle phase management from the main GameContext.
 * It is intended to be used by systems that manage or react to the battle's progression.
 */
import { GamePhaseType } from '../common/constants.js';

export class BattlePhaseContext {
    constructor() {
        // Represents the current phase of the battle
        this.battlePhase = GamePhaseType.IDLE;
        // Stores the winning team ID when the game is over
        this.winningTeam = null;
    }
}