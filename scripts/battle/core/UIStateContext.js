/**
 * @file UIStateContext Component
 * @description Manages UI-specific state (e.g., modal visibility, message queue).
 * This singleton component separates the concern of UI state management from the main GameContext.
 * It is intended to be used by systems that interact with UI display logic.
 */
export class UIStateContext {
    constructor() {
        // Whether the game is paused due to a modal being displayed
        this.isPausedByModal = false;
        // A queue for managing modal messages to avoid conflicts
        this.messageQueue = [];
    }
}