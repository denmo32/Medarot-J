/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 */

import { GameEvents } from './battle/common/events.js';
import { initializeSystems as initializeBattleSystems } from './battle/core/systemInitializer.js';
import { createPlayers as createBattlePlayers } from './battle/core/entityFactory.js';
import { GameModeContext } from './battle/core/index.js'; // Import new context for game mode
import { MAP_EVENTS, CONFIG as MAP_CONFIG, PLAYER_STATES } from './map/constants.js';
import { World } from './core/world.js';
import { Camera } from './map/camera.js';
import { Renderer } from './map/renderer.js';
import { Map } from './map/map.js';
import { InputHandler } from './map/inputHandler.js';
import * as MapComponents from './map/components.js';
import { PlayerInputSystem } from './map/systems/PlayerInputSystem.js';
import { MovementSystem } from './map/systems/MovementSystem.js';
import { CameraSystem } from './map/systems/CameraSystem.js';
import { RenderSystem as MapRenderSystem } from './map/systems/RenderSystem.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Global World Instance ---
    const world = new World();

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
        createBattlePlayers(world);
        const gameModeContext = world.getSingletonComponent(GameModeContext); // Use new context for game mode
        gameModeContext.gameMode = 'battle';

        world.emit(GameEvents.SETUP_UI_REQUESTED);
        
        world.on(GameEvents.GAME_OVER, () => setTimeout(switchToMapMode, 3000));
        world.on(GameEvents.RESET_BUTTON_CLICKED, switchToMapMode);
        
        world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    /**
     * Sets up the systems and entities for map exploration mode.
     */
    async function setupMapMode() {
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
        const input = new InputHandler();
        const camera = new Camera();
        const renderer = new Renderer(canvas);
        
        const response = await fetch('scripts/map/map.json');
        const mapData = await response.json();
        const map = new Map(mapData);

        // --- Register Map Systems ---
        world.registerSystem(new PlayerInputSystem(world, input, map));
        world.registerSystem(new MovementSystem(world, map));
        world.registerSystem(new CameraSystem(world, camera, map));
        world.registerSystem(new MapRenderSystem(world, renderer, map, camera));

        // --- Create Map Entities ---
        const playerEntityId = world.createEntity();
        const initialX = 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2;
        const initialY = 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2;

        world.addComponent(playerEntityId, new MapComponents.Position(initialX, initialY));
        world.addComponent(playerEntityId, new MapComponents.Velocity(0, 0));
        world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
        world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
        world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
        world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
        
        // --- Create Game Context ---
        // The new context components (GameModeContext, BattlePhaseContext, etc.) are created in initializeSystems
        // But we still create GameContext here for the gameMode property, which is now managed by GameModeContext
        // However, since main.js was using GameContext.gameMode, we need to ensure GameModeContext is created.
        // Let's create GameModeContext here for map mode, assuming systemInitializer.js handles battle mode.
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new GameModeContext()); // Create GameModeContext for map mode
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'map';
    }

    /**
     * Switches the game to map mode.
     */
    function switchToMapMode() {
        setupMapMode().then(() => {
            mapContainer.classList.remove('hidden');
            battleContainer.classList.add('hidden');
            console.log("Mode Switch: Map Exploration");
        });
    }

    /**
     * Switches the game to battle mode.
     */
    function switchToBattleMode() {
        console.log("Mode Switch: Battle");
        setupBattleMode();
        
        battleContainer.classList.remove('hidden');
        mapContainer.classList.add('hidden');
    }

    // --- Main Game Loop ---
    let lastTime = 0;
    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // Update all systems in the current mode
        world.update(deltaTime);

        requestAnimationFrame(gameLoop);
    }
    
    // --- Initial Setup ---
    
    await setupMapMode();

    mapContainer.classList.remove('hidden');
    battleContainer.classList.add('hidden');
    console.log("Mode Switch: Map Exploration");

    requestAnimationFrame(gameLoop);

    world.on(MAP_EVENTS.BATTLE_TRIGGERED, switchToBattleMode);

    window.focus();
});
