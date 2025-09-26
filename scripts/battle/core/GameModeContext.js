/**
 * @file GameModeContext Component
 * @description Manages the overall game mode (e.g., 'map', 'battle').
 * This singleton component separates the concern of game mode management from the main GameContext.
 * It is intended to be used by systems that need to know the current game mode but not necessarily
 * the battle phase or UI state.
 */
export class GameModeContext {
    constructor() {
        // Represents the current game mode (e.g., 'map' or 'battle')
        this.gameMode = 'map'; 
    }
}