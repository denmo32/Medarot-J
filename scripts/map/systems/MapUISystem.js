import { BaseSystem } from '../../core/baseSystem.js';
import { MapUIState } from '../../scenes/MapScene.js';
import * as MapComponents from '../components.js';
import { GameEvents } from '../../battle/common/events.js';

/**
 * マップモードにおけるUIの表示/非表示、およびUI操作中の入力を一元管理するシステム。
 * PlayerInputSystemからUI操作の責務を分離し、関心の分離を徹底します。
 */
export class MapUISystem extends BaseSystem {
    constructor(world, inputManager) {
        super(world);
        this.input = inputManager;
        // MapUIStateコンポーネントを参照する
        this.mapUIState = this.world.getSingletonComponent(MapUIState);

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

        // イベントリスナーの参照を保持（削除用）
        this.boundToggleMenu = this.toggleMenu.bind(this);
        this.boundShowNpcInteraction = this.showNpcInteraction.bind(this);
        
        // メニューのクリックハンドラを保持するMap
        this.menuClickHandlers = new Map();
        
        // インタラクションウィンドウのハンドラを保持
        this.interactionConfirmHandler = null;
        this.interactionCancelHandler = null;

        this.bindWorldEvents();
    }

    bindWorldEvents() {
        // PlayerInputSystemからのメニュー表示/非表示要求をリッスン
        this.world.on(GameEvents.MENU_TOGGLE_REQUESTED, this.boundToggleMenu);
        // PlayerInputSystemからのNPCインタラクション要求をリッスン
        this.world.on(GameEvents.NPC_INTERACTION_REQUESTED, this.boundShowNpcInteraction);
    }
    
    /**
     * システム破棄時のクリーンアップ
     * World.reset() や Scene.destroy() から呼び出されることを想定
     */
    destroy() {
        // メニューのクリックハンドラを削除
        this.removeMenuClickHandlers();
        
        // インタラクションウィンドウのハンドラを削除
        if (this.interactionConfirmHandler && this.dom.confirmBattleButton) {
            this.dom.confirmBattleButton.removeEventListener('click', this.interactionConfirmHandler);
        }
        if (this.interactionCancelHandler && this.dom.cancelBattleButton) {
            this.dom.cancelBattleButton.removeEventListener('click', this.interactionCancelHandler);
        }
        
        // DOMの状態をリセット（非表示にするなど）
        if (this.dom.menu) {
            this.dom.menu.classList.add('hidden');
        }
        if (this.dom.interactionWindow) {
            this.dom.interactionWindow.classList.add('hidden');
        }
    }

    update(deltaTime) {
        // メニューが開いていない場合、かつNPCインタラクションウィンドウが表示されていない場合にのみxキーでメニューを開く
        if (this.input.wasKeyJustPressed('x') && !this.mapUIState.isPausedByModal) {
            this.toggleMenu(); // イベントを介さず直接呼ぶ
            return; // メニュー操作をしたら他のUI入力は無視
        }

        // メニューが開いている場合の入力処理
        if (this.mapUIState && this.mapUIState.isMapMenuVisible) {
            this.handleMenuInput();
        }
        // NPCインタラクションウィンドウが開いている場合の入力処理
        else if (this.mapUIState && this.mapUIState.isPausedByModal && !this.mapUIState.isMapMenuVisible) {
            this.handleInteractionWindowInput();
        }
    }

    // --- Menu Logic --- //
    toggleMenu() {
        if (!this.dom.menu) {
            console.error('MapUISystem: map-menu element not found!');
            return;
        }

        this.mapUIState.isMapMenuVisible = !this.mapUIState.isMapMenuVisible;
        this.dom.menu.classList.toggle('hidden', !this.mapUIState.isMapMenuVisible);

        if (this.mapUIState) {
            this.mapUIState.isPausedByModal = this.mapUIState.isMapMenuVisible;
        }

        // UIStateContextの変更を通知
        this.world.emit(GameEvents.UI_STATE_CHANGED, { context: 'mapUI', property: 'isMapMenuVisible', value: this.mapUIState.isMapMenuVisible });

        if (this.mapUIState.isMapMenuVisible) {
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
        // 既存のハンドラがあれば削除
        this.removeMenuClickHandlers();

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
        // イベント発行時にペイロードを渡さない
        this.world.emit(GameEvents.GAME_SAVE_REQUESTED);
        console.log('Game save requested.');
    }

    openCustomizeScene() {
        this.world.emit(GameEvents.CUSTOMIZE_SCENE_REQUESTED);
    }

    // --- NPC Interaction Logic --- //

    showNpcInteraction(npc) {
        if (!this.dom.interactionWindow || !this.mapUIState) return;

        this.mapUIState.isPausedByModal = true;
        this.mapUIState.modalJustOpened = true; // main.jsのループで一度だけ無視されるように

        // 以前のリスナーが残っていたら削除
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

        // ハンドラをインスタンスプロパティとして保持
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