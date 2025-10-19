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
        // Flag to indicate a modal was just opened in the current frame
        this.modalJustOpened = false;
        // Map UI state
        this.isMapMenuVisible = false; // マップモードのポーズメニューが表示されているか
    }
}