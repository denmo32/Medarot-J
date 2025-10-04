/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 */

import { GameEvents } from './battle/common/events.js';
import { initializeSystems as initializeBattleSystems } from './battle/core/systemInitializer.js';
import { createPlayers as createBattlePlayers } from './battle/core/entityFactory.js';
import { GameModeContext, UIStateContext } from './battle/core/index.js'; // Import new context for game mode
import { MAP_EVENTS, CONFIG as MAP_CONFIG, PLAYER_STATES } from './map/constants.js';
import { CONFIG as BATTLE_CONFIG } from './battle/common/config.js';
import { UI_CONFIG } from './battle/common/UIConfig.js';
import { World } from './core/world.js';
import { Camera } from './map/camera.js';
import { Renderer } from './map/renderer.js';
import { Map } from './map/map.js';
import { InputManager } from './core/InputManager.js';
import * as MapComponents from './map/components.js';
import { PlayerInputSystem } from './map/systems/PlayerInputSystem.js';
import { MovementSystem } from './map/systems/MovementSystem.js';
import { CameraSystem } from './map/systems/CameraSystem.js';
import { RenderSystem as MapRenderSystem } from './map/systems/RenderSystem.js';
import { MapUISystem } from './map/systems/MapUISystem.js';
import { GameDataManager } from './core/GameDataManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Global World Instance ---
    const world = new World();

    // --- Global Input Manager ---
    const inputManager = new InputManager();

    // --- Global Game Data Manager ---
    const gameDataManager = new GameDataManager();

    // --- UI Elements ---
    const mapContainer = document.getElementById('map-container');
    const battleContainer = document.getElementById('battle-container');

    /**
     * Sets up the systems and entities required for battle mode.
     */
    function setupBattleMode() {
        world.emit(GameEvents.GAME_WILL_RESET);
        world.reset();

        initializeBattleSystems(world);

        // GameDataManagerからバトル用のプレイヤーデータを取得してエンティティを生成
        const playerTeamData = gameDataManager.getPlayerDataForBattle();
        createBattlePlayers(world, playerTeamData);

        const gameModeContext = world.getSingletonComponent(GameModeContext);
        if (gameModeContext) {
            gameModeContext.gameMode = 'battle';
        }

        world.emit(GameEvents.SETUP_UI_REQUESTED);
        
        world.on(GameEvents.GAME_OVER, (result) => {
            gameDataManager.applyBattleResult(result); // バトル結果をデータマネージャーに反映
            setTimeout(switchToMapMode, 3000);
        });
        world.on(GameEvents.RESET_BUTTON_CLICKED, switchToMapMode);
        
        world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    /**
     * Sets up the systems and entities for map exploration mode.
     */
    async function setupMapMode(options = {}) {
        world.emit(GameEvents.GAME_WILL_RESET);
        world.reset();
        
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }
        canvas.width = MAP_CONFIG.VIEWPORT_WIDTH;
        canvas.height = MAP_CONFIG.VIEWPORT_HEIGHT;

        // --- Map Mode Objects (to be passed to systems) ---
        const camera = new Camera();
        const renderer = new Renderer(canvas);
        
        const response = await fetch('scripts/map/map.json');
        const mapData = await response.json();
        const map = new Map(mapData);

        // --- Create Game Context ---
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new GameModeContext());
        const uiStateContext = new UIStateContext(); // UIStateContextインスタンスを生成
        world.addComponent(contextEntity, uiStateContext); // 追加

        // UI状態を初期化
        uiStateContext.isMapMenuVisible = false;
        uiStateContext.isPausedByModal = false;
        uiStateContext.modalJustOpened = false;

        // --- Register Map Systems ---
        const playerInputSystem = new PlayerInputSystem(world, inputManager, map);
        world.registerSystem(playerInputSystem);
        world.registerSystem(new MovementSystem(world, map));
        world.registerSystem(new CameraSystem(world, camera, map));
        world.registerSystem(new MapRenderSystem(world, renderer, map, camera));
        const mapUISystem = new MapUISystem(world, inputManager);
        world.registerSystem(mapUISystem);

        // --- Set Game Mode ---
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'map';

        // --- Create Map Entities ---
        const playerEntityId = world.createEntity();

        // GameDataManagerからプレイヤーデータを取得してエンティティを構築
        const mapPlayerData = gameDataManager.getPlayerDataForMap();
        const initialX = mapPlayerData.position.x;
        const initialY = mapPlayerData.position.y;

        world.addComponent(playerEntityId, new MapComponents.Position(initialX, initialY));
        world.addComponent(playerEntityId, new MapComponents.Velocity(0, 0));
        world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
        world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
        world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
        world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
        world.addComponent(playerEntityId, new MapComponents.FacingDirection('down'));

        // --- Event Listeners ---
        world.on(MAP_EVENTS.BATTLE_TRIGGERED, switchToBattleMode);
        world.on('NPC_INTERACTED', () => {
            console.log('NPC interacted, switching to battle mode');
            switchToBattleMode();
        });
        world.on('CUSTOMIZE_SCENE_REQUESTED', switchToCustomizeMode);
        
        // セーブ要求イベントのリスナー
        world.on('GAME_SAVE_REQUESTED', (payload) => {
            if (payload && payload.position) {
                gameDataManager.updatePlayerPosition(payload.position.x, payload.position.y);
                gameDataManager.saveGame();
            }
        });

        // optionsがrestoreMenuを要求する場合、メニューを開いた状態にする
        if (options.restoreMenu) {
            mapUISystem.toggleMenu();
        }


    }



    function switchToCustomizeMode() {
        console.log("Mode Switch: Customize");

        // プレイヤーの位置をGameDataManagerに保存
        const playerEntities = world.getEntitiesWith(MapComponents.PlayerControllable);
        if (playerEntities.length > 0) {
            const playerEntityId = playerEntities[0];
            const position = world.getComponent(playerEntityId, MapComponents.Position);
            if (position) {
                gameDataManager.updatePlayerPosition(position.x, position.y);
            }
        }
        
        setupCustomizeScene();
    }

    function setupCustomizeScene() {
        world.reset();
        
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new GameModeContext());
        world.addComponent(contextEntity, new UIStateContext());
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'customize';

        mapContainer.classList.add('hidden');
        battleContainer.classList.add('hidden');
        
        let customizeContainer = document.getElementById('customize-container');
        if (!customizeContainer) {
            customizeContainer = document.createElement('div');
            customizeContainer.id = 'customize-container';
            customizeContainer.className = 'customize-container';
            customizeContainer.innerHTML = '<h2>カスタマイズ画面</h2><p>実装中</p><p style="margin-top: 20px; font-size: 0.9em;">(Xキーでマップに戻る)</p>';
            document.body.appendChild(customizeContainer);
        } else {
            customizeContainer.classList.remove('hidden');
        }

        const handleCustomizeKeyDown = (event) => {
            if (event.key === 'x' || event.key === 'X') {
                window.removeEventListener('keydown', handleCustomizeKeyDown);
                
                const customizeContainer = document.getElementById('customize-container');
                if (customizeContainer) {
                    customizeContainer.classList.add('hidden');
                }
                
                switchToMapMode({ restoreMenu: true });
            }
        };
        window.addEventListener('keydown', handleCustomizeKeyDown);
    }

    /**
     * Switches the game to map mode.
     */
    function switchToMapMode(options = {}) {
        setupMapMode(options).then(() => {
            mapContainer.classList.remove('hidden');
            battleContainer.classList.add('hidden');
            console.log("Mode Switch: Map Exploration");
            inputManager.update();
        });
    }

    /**
     * Switches the game to battle mode.
     */
    function switchToBattleMode() {
        console.log("Mode Switch: Battle");

        // プレイヤーの位置をGameDataManagerに保存
        const playerEntities = world.getEntitiesWith(MapComponents.PlayerControllable);
        if (playerEntities.length > 0) {
            const playerEntityId = playerEntities[0];
            const position = world.getComponent(playerEntityId, MapComponents.Position);
            if (position) {
                gameDataManager.updatePlayerPosition(position.x, position.y);
            }
        }

        setupBattleMode();
        
        battleContainer.classList.remove('hidden');
        mapContainer.classList.add('hidden');
    }

    /**
     * Exports setup functions for external use (e.g., from customize scene).
     */
    window.MedarotJS = {
        setupMapMode,
    };

    // --- Main Game Loop ---
    let lastTime = 0;
    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // ワールド内の全システムを更新
        world.update(deltaTime);

        // 入力マネージャーの状態を更新
        inputManager.update();

        requestAnimationFrame(gameLoop);
    }
    
    // --- Initial Setup ---
    
    const titleContainer = document.getElementById('title-container');
    const startNewGameButton = document.getElementById('start-new-game');
    const startFromSaveButton = document.getElementById('start-from-save');

    if (localStorage.getItem('medarotJSaveData')) {
        startFromSaveButton.style.display = 'block';
    }

    startNewGameButton.addEventListener('click', async () => {
        // 新規ゲーム時はデータをリセットして保存
        gameDataManager.resetToDefault();
        gameDataManager.saveGame();
        await setupMapMode();
        // ★追加: setupMapMode完了後にInputManagerを更新
        inputManager.update(); 
        titleContainer.classList.add('hidden');
        mapContainer.classList.remove('hidden');
        battleContainer.classList.add('hidden');
        console.log("Mode Switch: Map Exploration (New Game)");
        requestAnimationFrame(gameLoop);
    });

    startFromSaveButton.addEventListener('click', async () => {
        // セーブデータからの開始時はデータをロード
        gameDataManager.loadGame();
        await setupMapMode();
        // ★追加: setupMapMode完了後にInputManagerを更新
        inputManager.update();
        titleContainer.classList.add('hidden');
        mapContainer.classList.remove('hidden');
        battleContainer.classList.add('hidden');
        console.log("Mode Switch: Map Exploration (From Save)");
        requestAnimationFrame(gameLoop);
    });

    titleContainer.classList.remove('hidden');
    mapContainer.classList.add('hidden');
    battleContainer.classList.add('hidden');

    // --- Game Screen Scaling ---
    function applyScaling() {
        const baseWidth = UI_CONFIG.SCALING.BASE_WIDTH;
        const baseHeight = UI_CONFIG.SCALING.BASE_HEIGHT;
        const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
        
        if (battleContainer) {
            battleContainer.style.width = `${baseWidth}px`;
            battleContainer.style.height = `${baseHeight}px`;
            battleContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
        if (mapContainer) {
            mapContainer.style.width = `${baseWidth}px`;
            mapContainer.style.height = `${baseHeight}px`;
            mapContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
    }

    window.addEventListener('resize', applyScaling);
    applyScaling();

    // --- Title Screen Input ---
    function setupTitleScreenInput() {
        const titleContainer = document.getElementById('title-container');
        if (!titleContainer) return;

        const buttons = [
            document.getElementById('start-new-game'),
            document.getElementById('start-from-save')
        ];
        let focusedIndex = 0;

        function updateFocus() {
            const visibleButtons = buttons.filter(btn => btn && btn.style.display !== 'none');
            if (visibleButtons.length === 0) return;
            focusedIndex = Math.max(0, Math.min(focusedIndex, visibleButtons.length - 1));
            visibleButtons.forEach((btn, index) => {
                if (index === focusedIndex) btn.focus();
            });
        }

        function handleKeyDown(e) {
            if (titleContainer.classList.contains('hidden')) {
                window.removeEventListener('keydown', handleKeyDown);
                return;
            }
            const visibleButtons = buttons.filter(btn => btn && btn.style.display !== 'none');
            if (visibleButtons.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedIndex = (focusedIndex + 1) % visibleButtons.length;
                updateFocus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIndex = (focusedIndex - 1 + visibleButtons.length) % visibleButtons.length;
                updateFocus();
            } else if (e.key === 'z') {
                e.preventDefault();
                visibleButtons[focusedIndex].click();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        
        const visibleButtons = buttons.filter(btn => btn && btn.style.display !== 'none');
        if (visibleButtons.length > 0) {
            focusedIndex = 0;
            updateFocus();
        }
    }

    setupTitleScreenInput();
    window.focus();
});
