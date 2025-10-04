import { BaseSystem } from '../../core/baseSystem.js';
import { UIStateContext } from '../../battle/core/UIStateContext.js';
import * as MapComponents from '../components.js';

/**
 * マップモードにおけるUIの表示/非表示、およびUI操作中の入力を一元管理するシステム。
 * PlayerInputSystemからUI操作の責務を分離し、関心の分離を徹底します。
 */
export class MapUISystem extends BaseSystem {
    constructor(world, inputManager) {
        super(world);
        this.input = inputManager;
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);

        // DOM要素の参照
        this.dom = {
            menu: document.getElementById('map-menu'),
            interactionWindow: document.getElementById('interaction-message-window'),
            confirmBattleButton: document.getElementById('confirm-battle-button'),
            cancelBattleButton: document.getElementById('cancel-battle-button'),
        };

        this.menuButtons = [];
        this.focusedMenuIndex = 0;
        this.isMenuOpen = false;

        this.bindWorldEvents();
    }

    bindWorldEvents() {
        // PlayerInputSystemからのメニュー表示/非表示要求をリッスン
        this.world.on('MENU_TOGGLE_REQUESTED', this.toggleMenu.bind(this));
        // PlayerInputSystemからのNPCインタラクション要求をリッスン
        this.world.on('NPC_INTERACTION_REQUESTED', this.showNpcInteraction.bind(this));
    }

    update(deltaTime) {
        // メニューが開いていない場合、かつNPCインタラクションウィンドウが表示されていない場合にのみxキーでメニューを開く
        if (this.input.wasKeyJustPressed('x') && !this.uiStateContext.isPausedByModal) {
            this.toggleMenu(); // イベントを介さず直接呼ぶ
            return; // メニュー操作をしたら他のUI入力は無視
        }

        // メニューが開いている場合の入力処理
        if (this.uiStateContext && this.uiStateContext.isMapMenuVisible) {
            this.handleMenuInput();
        }
        // NPCインタラクションウィンドウが開いている場合の入力処理
        else if (this.uiStateContext && this.uiStateContext.isPausedByModal && !this.uiStateContext.isMapMenuVisible) {
            this.handleInteractionWindowInput();
        }
    }

    // --- Menu Logic --- //

    toggleMenu() {
        // console.log('MapUISystem: toggleMenu called. Current isMenuOpen:', this.isMenuOpen); // ★デバッグログ
        if (!this.dom.menu) {
            console.error('MapUISystem: map-menu element not found!'); // ★エラーログ
            return;
        }

        this.uiStateContext.isMapMenuVisible = !this.uiStateContext.isMapMenuVisible;
        this.dom.menu.classList.toggle('hidden', !this.uiStateContext.isMapMenuVisible);
        // console.log('MapUISystem: Menu visibility toggled. New isMenuOpen:', this.isMenuOpen, 'hidden class:', this.dom.menu.classList.contains('hidden')); // ★デバッグログ

        const uiStateContext = this.world.getSingletonComponent(UIStateContext);

        if (this.uiStateContext) {
            this.uiStateContext.isPausedByModal = this.uiStateContext.isMapMenuVisible;
        }

        // UIStateContextの変更を通知
        this.world.emit('UI_STATE_CHANGED', { context: 'mapUI', property: 'isMapMenuVisible', value: this.uiStateContext.isMapMenuVisible });

        if (this.uiStateContext.isMapMenuVisible) {
            const saveButton = this.dom.menu.querySelector('.map-menu-button[data-action="save"]');
            const medarotchiButton = this.dom.menu.querySelector('.map-menu-button[data-action="medarotchi"]');
            this.menuButtons = [medarotchiButton, saveButton].filter(btn => btn);
            this.focusedMenuIndex = 0;
            this.setupMenuClickHandlers();
            this.updateMenuFocus();
        } else {
            this.removeFocusIndicators();
            this.removeMenuClickHandlers();
        }
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
        // メニューが開いているとき、xキーでメニューを閉じる
        if (this.input.wasKeyJustPressed('x')) {
            this.toggleMenu();
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
        this.menuClickHandlers = new Map();
        this.menuButtons.forEach(button => {
            const action = button.dataset.action;
            let handler;
            if (action === 'save') {
                handler = () => { this.saveGame(); this.toggleMenu(); };
            } else if (action === 'medarotchi') {
                handler = () => { this.openCustomizeScene(); this.toggleMenu(); };
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
        const playerEntity = this.world.getEntitiesWith(MapComponents.PlayerControllable)[0];
        if (!playerEntity) return;
        const position = this.world.getComponent(playerEntity, MapComponents.Position);
        this.world.emit('GAME_SAVE_REQUESTED', { position: { x: position.x, y: position.y } });
        console.log('Game save requested.');
    }

    openCustomizeScene() {
        this.world.emit('CUSTOMIZE_SCENE_REQUESTED');
    }

    // --- NPC Interaction Logic --- //

    showNpcInteraction(npc) {
        if (!this.dom.interactionWindow || !this.uiStateContext) return;

        this.uiStateContext.isPausedByModal = true;
        this.uiStateContext.modalJustOpened = true; // main.jsのループで一度だけ無視されるように

        const cleanup = () => {
            this.dom.confirmBattleButton.removeEventListener('click', handleConfirm);
            this.dom.cancelBattleButton.removeEventListener('click', handleCancel);
            this.dom.interactionWindow.classList.add('hidden');
            if (this.uiStateContext) {
                this.uiStateContext.isPausedByModal = false;
            }
        };

        const handleConfirm = () => {
            cleanup();
            this.world.emit('NPC_INTERACTED', npc);
        };

        const handleCancel = () => {
            cleanup();
            const canvas = document.getElementById('game-canvas');
            if (canvas) canvas.focus();
        };

        this.dom.confirmBattleButton.addEventListener('click', handleConfirm);
        this.dom.cancelBattleButton.addEventListener('click', handleCancel);

        this.dom.interactionWindow.classList.remove('hidden');
        this.dom.confirmBattleButton.focus();
    }

    handleInteractionWindowInput() {
        if (this.uiStateContext.modalJustOpened) {
            this.uiStateContext.modalJustOpened = false;
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
