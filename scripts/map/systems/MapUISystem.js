import { System } from '../../../engine/core/System.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { GameEvents } from '../../common/events.js';
import { InputManager } from '../../../engine/input/InputManager.js';
import { MapUIManager } from '../ui/MapUIManager.js';

export class MapUISystem extends System {
    constructor(world) {
        super(world);
        this.input = this.world.getSingletonComponent(InputManager);
        this.mapUIState = this.world.getSingletonComponent(MapUIState);
        this.uiManager = new MapUIManager();

        this.focusedMenuIndex = 0;
        
        this._handlers = {
            toggleMenu: this.toggleMenu.bind(this),
            showNpcInteraction: this.showNpcInteraction.bind(this),
        };

        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.MENU_TOGGLE_REQUESTED, this._handlers.toggleMenu);
        this.on(GameEvents.NPC_INTERACTION_REQUESTED, this._handlers.showNpcInteraction);
    }
    
    destroy() {
        // UI非表示 (イベントリスナー解除はManager側のクローン置換で対応されるため明示的なremove不要だが、非表示は必要)
        this.uiManager.hideMenu();
        this.uiManager.hideInteractionWindow();
        super.destroy();
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
        if (!this.mapUIState) return;
        
        this.mapUIState.isMapMenuVisible = true;
        this.mapUIState.isPausedByModal = true;
        this.uiManager.showMenu();

        this.world.emit(GameEvents.UI_STATE_CHANGED, { context: 'mapUI', property: 'isMapMenuVisible', value: true });

        this.focusedMenuIndex = 0;
        
        // アクションのバインド
        this.uiManager.bindMenuAction('save', () => { this.saveGame(); this.closeMenu(); });
        this.uiManager.bindMenuAction('medarotchi', () => { this.openCustomizeScene(); this.closeMenu(); });
        
        this.uiManager.updateMenuFocus(this.focusedMenuIndex);
    }

    closeMenu() {
        if (!this.mapUIState) return;

        this.mapUIState.isMapMenuVisible = false;
        this.mapUIState.isPausedByModal = false;
        this.uiManager.hideMenu();

        this.world.emit(GameEvents.UI_STATE_CHANGED, { context: 'mapUI', property: 'isMapMenuVisible', value: false });
    }

    handleMenuInput() {
        const count = this.uiManager.getMenuButtonCount();
        if (count === 0) return;

        if (this.input.wasKeyJustPressed('ArrowUp')) {
            this.focusedMenuIndex = (this.focusedMenuIndex > 0) ? this.focusedMenuIndex - 1 : count - 1;
            this.uiManager.updateMenuFocus(this.focusedMenuIndex);
        }
        if (this.input.wasKeyJustPressed('ArrowDown')) {
            this.focusedMenuIndex = (this.focusedMenuIndex < count - 1) ? this.focusedMenuIndex + 1 : 0;
            this.uiManager.updateMenuFocus(this.focusedMenuIndex);
        }
        if (this.input.wasKeyJustPressed('z')) {
            this.uiManager.triggerMenuButton(this.focusedMenuIndex);
        }
        if (this.input.wasKeyJustPressed('x')) {
            this.closeMenu();
        }
    }

    saveGame() {
        this.world.emit(GameEvents.GAME_SAVE_REQUESTED);
    }

    openCustomizeScene() {
        this.world.emit(GameEvents.CUSTOMIZE_SCENE_REQUESTED);
    }

    showNpcInteraction(npc) {
        if (!this.mapUIState) return;

        this.mapUIState.isPausedByModal = true;
        this.mapUIState.modalJustOpened = true; 

        const closeWindow = () => {
            this.uiManager.hideInteractionWindow();
            if (this.mapUIState) this.mapUIState.isPausedByModal = false;
        };

        const onConfirm = () => {
            closeWindow();
            this.world.emit(GameEvents.NPC_INTERACTED, npc);
        };

        const onCancel = () => {
            closeWindow();
            // Canvasへのフォーカス戻しなどは本来GlobalなInput管理で行うべきだが、
            // ここでは簡易的にDOMUtils等を使わずとも、クリックイベント終了でフォーカスが外れるのを防ぐ程度とする
             document.getElementById('game-canvas')?.focus();
        };

        this.uiManager.bindInteractionActions(onConfirm, onCancel);
        this.uiManager.showInteractionWindow();
    }

    handleInteractionWindowInput() {
        if (this.mapUIState.modalJustOpened) {
            this.mapUIState.modalJustOpened = false;
            return;
        }

        if (this.input.wasKeyJustPressed('ArrowLeft') || this.input.wasKeyJustPressed('ArrowRight') || this.input.wasKeyJustPressed('ArrowUp') || this.input.wasKeyJustPressed('ArrowDown')) {
            // 現在のフォーカスを確認してトグルするロジックはManager側で持つべきだが、
            // 簡易的にアクティブ要素を確認する
            if (document.activeElement?.id === 'confirm-battle-button') {
                this.uiManager.focusCancelButton();
            } else {
                this.uiManager.focusConfirmButton();
            }
        }

        if (this.input.wasKeyJustPressed('z')) {
            this.uiManager.clickActiveButton();
        }

        if (this.input.wasKeyJustPressed('x')) {
            this.uiManager.clickCancelButton();
        }
    }
}