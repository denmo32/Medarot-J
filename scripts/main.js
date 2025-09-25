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
import { GameContext, GameState, Gauge } from './battle/core/components.js';
import { GamePhaseType, PlayerStateType } from './battle/common/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Game State Containers ---
    let battleWorld = new World();
    let rpgGame = null;
    let gameContext = null; // battleWorldから取得するシングルトン

    // --- UI Elements ---
    const mapContainer = document.getElementById('map-container');
    const battleContainer = document.getElementById('battle-container');
    const gameStartButton = document.getElementById('gameStartButton');

    // --- Game Management ---

    /**
     * 戦闘システムを初期化（またはリセット）します。
     */
    function initializeBattle() {
        if (battleWorld.listeners.size > 0) {
            battleWorld.emit(GameEvents.GAME_WILL_RESET);
        }
        for (const system of battleWorld.systems) {
            if (system.destroy) system.destroy();
        }

        battleWorld = new World();
        initializeBattleSystems(battleWorld);
        createBattlePlayers(battleWorld);
        gameContext = battleWorld.getSingletonComponent(GameContext);

        battleWorld.emit(GameEvents.SETUP_UI_REQUESTED);
        
        // 戦闘終了後にマップモードに戻るイベントを設定
        battleWorld.on(GameEvents.GAME_OVER, () => setTimeout(switchToMapMode, 3000));
        battleWorld.on(GameEvents.RESET_BUTTON_CLICKED, switchToMapMode);
    }

    /**
     * マップ探索システムを初期化します。
     */
    async function initializeMap() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }
        rpgGame = new RpgGame(canvas);
        await rpgGame.init();
    }

    /**
     * マップモードに切り替えます。
     */
    function switchToMapMode() {
        if (gameContext) gameContext.gameMode = 'map';
        mapContainer.classList.remove('hidden');
        battleContainer.classList.add('hidden');
        console.log("モード切替: マップ探索");
    }

    /**
     * 戦闘モードに切り替えます。
     */
    function switchToBattleMode() {
        console.log("モード切替: 戦闘");
        initializeBattle();
        if (gameContext) {
            gameContext.gameMode = 'battle';
            // GameFlowSystemに戦闘開始確認を要求
            battleWorld.emit(GameEvents.GAME_START_CONFIRMED);
        }
        
        battleContainer.classList.remove('hidden');
        mapContainer.classList.add('hidden');
    }

    // --- Main Game Loop ---
    let lastTime = 0;
    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        if (gameContext) {
            if (gameContext.gameMode === 'map' && rpgGame) {
                rpgGame.update(deltaTime);
                rpgGame.draw();
            } else if (gameContext.gameMode === 'battle') {
                battleWorld.update(deltaTime);
            }
        }

        requestAnimationFrame(gameLoop);
    }
    
    // --- Initial Setup ---
    
    // 1. 戦闘システムを初期化し、gameContext を取得
    initializeBattle();
    // 2. マップシステムを初期化
    await initializeMap();

    // 3. 初期モードをマップに設定
    switchToMapMode();

    // 4. メインループを開始
    requestAnimationFrame(gameLoop);

    // 5. マップからの戦闘開始イベントをリッスン
    window.addEventListener('startbattle', switchToBattleMode);
});
