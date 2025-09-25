/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 */

import { World } from './core/world.js';
import { Game as RpgGame } from './map/game.js';
import { GameEvents } from './battle/common/events.js';
import { initializeSystems as initializeBattleSystems } from './battle/core/systemInitializer.js';
import { createPlayers as createBattlePlayers } from './battle/core/entityFactory.js';
// 必要なコンポーネントを直接インポート
import { GameContext } from './battle/core/components.js';
import { MAP_EVENTS } from './map/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Global World Instance ---
    const world = new World();
    let rpgGame = null; // TODO: This will be integrated into ECS later.

    // --- UI Elements ---
    const mapContainer = document.getElementById('map-container');
    const battleContainer = document.getElementById('battle-container');

    /**
     * Clears the state of the world instance.
     * @param {World} worldInstance 
     */
    function clearWorld(worldInstance) {
        worldInstance.emit(GameEvents.GAME_WILL_RESET);
        
        for (const system of worldInstance.systems) {
            if (system.destroy) {
                system.destroy();
            }
        }
        
        worldInstance.listeners.clear();
        worldInstance.systems = [];
        worldInstance.entities.clear();
        worldInstance.components.clear();
        worldInstance.nextEntityId = 0;
    }

    /**
     * Sets up the systems and entities required for battle mode.
     */
    function setupBattleMode() {
        clearWorld(world);

        initializeBattleSystems(world);
        createBattlePlayers(world);
        const gameContext = world.getSingletonComponent(GameContext);
        gameContext.gameMode = 'battle';

        world.emit(GameEvents.SETUP_UI_REQUESTED);
        
        world.on(GameEvents.GAME_OVER, () => setTimeout(switchToMapMode, 3000));
        world.on(GameEvents.RESET_BUTTON_CLICKED, switchToMapMode);
        
        world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    /**
     * Sets up the objects required for map exploration mode.
     */
    async function setupMapMode() {
        clearWorld(world);
        
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        rpgGame = new RpgGame(canvas, world); 
        await rpgGame.init();
        
        // Create a temporary GameContext for map mode
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new GameContext());
        const gameContext = world.getSingletonComponent(GameContext);
        gameContext.gameMode = 'map';
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

        const gameContext = world.getSingletonComponent(GameContext);

        if (gameContext) {
            if (gameContext.gameMode === 'map') {
                rpgGame.update(deltaTime);
                rpgGame.draw();
            } else if (gameContext.gameMode === 'battle') {
                world.update(deltaTime);
            }
        }

        requestAnimationFrame(gameLoop);
    }
    
    // --- Initial Setup ---
    
    await setupMapMode();

    mapContainer.classList.remove('hidden');
    battleContainer.classList.add('hidden');
    console.log("Mode Switch: Map Exploration");

    requestAnimationFrame(gameLoop);

    world.on(MAP_EVENTS.BATTLE_TRIGGERED, switchToBattleMode);
});
