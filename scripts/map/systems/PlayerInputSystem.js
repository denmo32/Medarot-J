import { BaseSystem } from '../../core/baseSystem.js';
import * as MapComponents from '../components.js';
import { CONFIG, PLAYER_STATES } from '../constants.js';
import { UIStateContext } from '../../battle/core/UIStateContext.js';

/**
 * プレイヤーの入力に基づいて目標タイルを設定し、状態を遷移させるシステム。
 */

export class PlayerInputSystem extends BaseSystem {
    constructor(world, input, map) {
        super(world);
        this.input = input;
        this.map = map;
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);

        this.menuButtons = [];
        this.focusedMenuIndex = 0;
    }

    update() {
        const menuElement = document.getElementById('map-menu');
        const isMenuOpen = menuElement && !menuElement.classList.contains('hidden');

        // 1. メニューが開いている場合の入力処理
        if (isMenuOpen) {
            this.handleMenuInput();
            return; // メニュー表示中は他の処理をブロック
        }

        // 2. 他のモーダルやUIが表示されている場合は入力をブロック
        const customizeElement = document.getElementById('customize-container');
        if ((customizeElement && !customizeElement.classList.contains('hidden')) || (this.uiStateContext && this.uiStateContext.isPausedByModal)) {
            return;
        }

        // 3. 通常のマップ操作入力処理
        this.handleMapInput();
    }

    handleMenuInput() {
        if (this.input.wasKeyJustPressed('x')) {
            this.toggleMenu();
            return;
        }
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
    }

    handleMapInput() {
        // メニューを開く
        if (this.input.wasKeyJustPressed('x')) {
            this.toggleMenu();
            return;
        }

        const entities = this.world.getEntitiesWith(
            MapComponents.PlayerControllable, 
            MapComponents.State, 
            MapComponents.Position,
            MapComponents.Collision
        );

        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, MapComponents.State);

            // アイドル状態での移動入力
            if (state.value === PLAYER_STATES.IDLE && this.input.direction) {
                this.handleMovementInput(entityId);
            }

            // インタラクション入力
            if (this.input.wasKeyJustPressed('z')) {
                this.handleInteractionInput(entityId);
            }
        }
    }

    handleMovementInput(entityId) {
        const position = this.world.getComponent(entityId, MapComponents.Position);
        const collision = this.world.getComponent(entityId, MapComponents.Collision);
        const state = this.world.getComponent(entityId, MapComponents.State);

        let targetX = position.x;
        let targetY = position.y;

        const currentTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const currentTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const baseTargetX = currentTileX * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
        const baseTargetY = currentTileY * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;

        switch (this.input.direction) {
            case 'up':    targetY = baseTargetY - CONFIG.TILE_SIZE; break;
            case 'down':  targetY = baseTargetY + CONFIG.TILE_SIZE; break;
            case 'left':  targetX = baseTargetX - CONFIG.TILE_SIZE; break;
            case 'right': targetX = baseTargetX + CONFIG.TILE_SIZE; break;
        }

        const bounds = { x: targetX, y: targetY, width: collision.width, height: collision.height };

        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        if (facingDirection) facingDirection.direction = this.input.direction;
        else this.world.addComponent(entityId, new MapComponents.FacingDirection(this.input.direction));

        if (!this.map.isColliding(bounds)) {
            state.value = PLAYER_STATES.WALKING;
            this.world.addComponent(entityId, new MapComponents.TargetPosition(targetX, targetY));
        }
    }

    handleInteractionInput(entityId) {
        const position = this.world.getComponent(entityId, MapComponents.Position);
        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        const playerTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
        const playerTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);

        for (const npc of this.map.npcs) {
            if (
                (playerTileX === npc.x && playerTileY === npc.y - 1 && facingDirection.direction === 'down') ||
                (playerTileX === npc.x && playerTileY === npc.y + 1 && facingDirection.direction === 'up') ||
                (playerTileX === npc.x - 1 && playerTileY === npc.y && facingDirection.direction === 'right') ||
                (playerTileX === npc.x + 1 && playerTileY === npc.y && facingDirection.direction === 'left')
            ) {
                this.world.emit('NPC_INTERACTION_REQUESTED', npc);
                break;
            }
        }
    }

    toggleMenu() {
        const menuElement = document.getElementById('map-menu');
        if (!menuElement) return;

        const willBeOpen = menuElement.classList.contains('hidden');
        menuElement.classList.toggle('hidden');

        if (willBeOpen) {
            const saveButton = document.querySelector('.map-menu-button[data-action="save"]');
            const medarotchiButton = document.querySelector('.map-menu-button[data-action="medarotchi"]');
            this.menuButtons = [medarotchiButton, saveButton].filter(btn => btn);
            this.focusedMenuIndex = 0;
            this.setupMenuClickHandlers();
            this.updateMenuFocus();
        } else {
            this.removeFocusIndicators();
            this.removeMenuClickHandlers();
        }
    }

    updateMenuFocus() {
        this.removeFocusIndicators();
        const button = this.menuButtons[this.focusedMenuIndex];
        if (button) {
            button.focus();
            const indicator = document.createElement('span');
            indicator.className = 'focus-indicator';
            indicator.textContent = '▶';
            button.parentElement.insertBefore(indicator, button);
            indicator.style.position = 'absolute';
            indicator.style.left = (button.offsetLeft - 20) + 'px';
            indicator.style.top = (button.offsetTop + button.offsetHeight / 2 - indicator.offsetHeight / 2) + 'px';
        }
    }

    removeFocusIndicators() {
        document.querySelectorAll('.focus-indicator').forEach(el => el.remove());
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
        const gameState = { position: { x: position.x, y: position.y }, mapName: 'map.json' };
        localStorage.setItem('medarotJSaveData', JSON.stringify(gameState));
        console.log('Game saved successfully:', gameState);
    }

    openCustomizeScene() {
        import('../../customize/scene.js')
            .then(module => module.setupCustomizeMode(this.world))
            .catch(err => console.error('Failed to load customize scene:', err));
    }
}
