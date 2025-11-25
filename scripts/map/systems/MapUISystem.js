import { System } from '../../../engine/core/System.js';
import { MapUIState } from '../../scenes/MapScene.js';
import * as MapComponents from '../components.js';
import { GameEvents } from '../../common/events.js';
// InputManager パス修正
import { InputManager } from '../../../engine/input/InputManager.js';

export class MapUISystem extends System {
    constructor(world) {
        super(world);
        this.input = this.world.getSingletonComponent(InputManager);
        this.mapUIState = this.world.getSingletonComponent(MapUIState);

        this.dom = {
            menu: document.getElementById('map-menu'),
            interactionWindow: document.getElementById('interaction-message-window'),
            confirmBattleButton: document.getElementById('confirm-battle-button'),
            cancelBattleButton: document.getElementById('cancel-battle-button'),
        };

        this.menuButtons = [];
        this.focusedMenuIndex = 0;
        
        this.boundToggleMenu = this.toggleMenu.bind(this);
        this.boundShowNpcInteraction = this.showNpcInteraction.bind(this);
        this.menuClickHandlers = new Map();
        
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.world.on(GameEvents.MENU_TOGGLE_REQUESTED, this.boundToggleMenu);
        this.world.on(GameEvents.NPC_INTERACTION_REQUESTED, this.boundShowNpcInteraction);
    }
    
    destroy() {
        this.removeMenuClickHandlers();
        
        if (this.interactionConfirmHandler && this.dom.confirmBattleButton) {
            this.dom.confirmBattleButton.removeEventListener('click', this.interactionConfirmHandler);
        }
        if (this.interactionCancelHandler && this.dom.cancelBattleButton) {
            this.dom.cancelBattleButton.removeEventListener('click', this.interactionCancelHandler);
        }
        
        if (this.dom.menu) {
            this.dom.menu.classList.add('hidden');
        }
        if (this.dom.interactionWindow) {
            this.dom.interactionWindow.classList.add('hidden');
        }
    }

    update(deltaTime) {
        if (!this.input) return;

        if (this.input.wasKeyJustPressed('x') && !this.mapUIState.isPausedByModal) {
            this.toggleMenu();
            return;
        }

        if (this.mapUIState && this.mapUIState.isMapMenuVisible) {
            this.handleMenuInput();
        } else if (this.mapUIState && this.mapUIState.isPausedByModal) {
            this.handleInteractionWindowInput();
        }
    }

    toggleMenu() {
        if (!this.mapUIState) return;

        if (this.mapUIState.isMapMenuVisible) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        if (!this.dom.menu || !this.mapUIState) return;
        
        this.mapUIState.isMapMenuVisible = true;
        this.mapUIState.isPausedByModal = true;
        this.dom.menu.classList.remove('hidden');

        this.world.emit(GameEvents.UI_STATE_CHANGED, { context: 'mapUI', property: 'isMapMenuVisible', value: true });

        const saveButton = this.dom.menu.querySelector('.map-menu-button[data-action="save"]');
        const medarotchiButton = this.dom.menu.querySelector('.map-menu-button[data-action="medarotchi"]');
        this.menuButtons = [medarotchiButton, saveButton].filter(btn => btn);
        this.focusedMenuIndex = 0;
        
        this.setupMenuClickHandlers();
        this.updateMenuFocus();
    }

    closeMenu() {
        if (!this.dom.menu || !this.mapUIState) return;

        this.mapUIState.isMapMenuVisible = false;
        this.mapUIState.isPausedByModal = false;
        this.dom.menu.classList.add('hidden');

        this.world.emit(GameEvents.UI_STATE_CHANGED, { context: 'mapUI', property: 'isMapMenuVisible', value: false });

        this.removeFocusIndicators();
        this.removeMenuClickHandlers();
    }

    handleMenuInput() {
        if (this.input.wasKeyJustPressed('ArrowUp')) {
            this.focusedMenuIndex = (this.focusedMenuIndex > 0) ? this.focusedMenuIndex - 1 : this.menuButtons.length - 1;
            this.updateMenuFocus();
        }
        if (this.input.wasKeyJustPressed('ArrowDown')) {
            this.focusedMenuIndex = (this.focusedMenuIndex < this.menuButtons.length - 1) ? this.focusedMenuIndex + 1 : 0;
            this.updateMenuFocus();
        }
        if (this.input.wasKeyJustPressed('z')) {
            if (this.menuButtons[this.focusedMenuIndex]) {
                this.menuButtons[this.focusedMenuIndex].click();
            }
        }
        if (this.input.wasKeyJustPressed('x')) {
            this.closeMenu();
        }
    }

    updateMenuFocus() {
        this.menuButtons.forEach(btn => btn.classList.remove('focused'));
        const button = this.menuButtons[this.focusedMenuIndex];
        if (button) {
            button.focus();
            button.classList.add('focused');
        }
    }

    removeFocusIndicators() {
        this.menuButtons.forEach(btn => btn.classList.remove('focused'));
    }

    setupMenuClickHandlers() {
        this.removeMenuClickHandlers();

        this.menuButtons.forEach(button => {
            const action = button.dataset.action;
            let handler;
            if (action === 'save') {
                handler = () => { this.saveGame(); this.closeMenu(); };
            } else if (action === 'medarotchi') {
                handler = () => { this.openCustomizeScene(); this.closeMenu(); };
            }
            if (handler) {
                button.addEventListener('click', handler);
                this.menuClickHandlers.set(button, handler);
            }
        });
    }

    removeMenuClickHandlers() {
        if (this.menuClickHandlers) {
            this.menuClickHandlers.forEach((handler, button) => {
                button.removeEventListener('click', handler);
            });
            this.menuClickHandlers.clear();
        }
    }

    saveGame() {
        this.world.emit(GameEvents.GAME_SAVE_REQUESTED);
    }

    openCustomizeScene() {
        this.world.emit(GameEvents.CUSTOMIZE_SCENE_REQUESTED);
    }

    showNpcInteraction(npc) {
        if (!this.dom.interactionWindow || !this.mapUIState) return;

        this.mapUIState.isPausedByModal = true;
        this.mapUIState.modalJustOpened = true; 

        if (this.interactionConfirmHandler) {
            this.dom.confirmBattleButton.removeEventListener('click', this.interactionConfirmHandler);
        }
        if (this.interactionCancelHandler) {
            this.dom.cancelBattleButton.removeEventListener('click', this.interactionCancelHandler);
        }

        const cleanup = () => {
            if (this.interactionConfirmHandler) {
                this.dom.confirmBattleButton.removeEventListener('click', this.interactionConfirmHandler);
                this.interactionConfirmHandler = null;
            }
            if (this.interactionCancelHandler) {
                this.dom.cancelBattleButton.removeEventListener('click', this.interactionCancelHandler);
                this.interactionCancelHandler = null;
            }
            this.dom.interactionWindow.classList.add('hidden');
            if (this.mapUIState) {
                this.mapUIState.isPausedByModal = false;
            }
        };

        this.interactionConfirmHandler = () => {
            cleanup();
            this.world.emit(GameEvents.NPC_INTERACTED, npc);
        };

        this.interactionCancelHandler = () => {
            cleanup();
            const canvas = document.getElementById('game-canvas');
            if (canvas) canvas.focus();
        };

        this.dom.confirmBattleButton.addEventListener('click', this.interactionConfirmHandler);
        this.dom.cancelBattleButton.addEventListener('click', this.interactionCancelHandler);

        this.dom.interactionWindow.classList.remove('hidden');
        this.dom.confirmBattleButton.focus();
    }

    handleInteractionWindowInput() {
        if (this.mapUIState.modalJustOpened) {
            this.mapUIState.modalJustOpened = false;
            return;
        }

        if (this.input.wasKeyJustPressed('ArrowLeft') || this.input.wasKeyJustPressed('ArrowRight') || this.input.wasKeyJustPressed('ArrowUp') || this.input.wasKeyJustPressed('ArrowDown')) {
            if (document.activeElement === this.dom.confirmBattleButton) {
                this.dom.cancelBattleButton.focus();
            } else {
                this.dom.confirmBattleButton.focus();
            }
        }

        if (this.input.wasKeyJustPressed('z')) {
            if (document.activeElement instanceof HTMLButtonElement) {
                document.activeElement.click();
            } else {
                this.dom.confirmBattleButton.click();
            }
        }

        if (this.input.wasKeyJustPressed('x')) {
            this.dom.cancelBattleButton.click();
        }
    }
}