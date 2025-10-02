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

        // --- Create Game Context ---
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new GameModeContext()); // Create GameModeContext for map mode
        world.addComponent(contextEntity, new UIStateContext());
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'map';

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
        world.addComponent(playerEntityId, new MapComponents.FacingDirection('down'));

        // NOTE: world.reset()でリスナーがクリアされるため、マップモード設定時に再登録する
        world.on(MAP_EVENTS.BATTLE_TRIGGERED, switchToBattleMode);

        // Zキー入力によるバトルシーンへの移行処理
        world.on('NPC_INTERACTED', () => {
            console.log('NPC interacted, switching to battle mode');
            switchToBattleMode();
        });

        // NPCとのインタラクション要求イベント (メッセージウィンドウを表示するために追加)
        world.on('NPC_INTERACTION_REQUESTED', (npc) => {
            console.log('NPC interaction requested, showing message window');
            setupNpcInteractionModal(world, npc, input);
        });
    }

    /**
     * Displays the NPC interaction modal and handles user input.
     * @param {World} world - The game world instance.
     * @param {object} npc - The NPC object that triggered the interaction.
     * @param {InputHandler} input - The input handler instance.
     */
    function setupNpcInteractionModal(world, npc, input) {
        const messageWindow = document.getElementById('interaction-message-window');
        const confirmButton = document.getElementById('confirm-battle-button');
        const cancelButton = document.getElementById('cancel-battle-button');
        const uiStateContext = world.getSingletonComponent(UIStateContext);

        if (uiStateContext) {
            uiStateContext.isPausedByModal = true;
        }

        // --- リスナーの管理 ---
        // NOTE: リスナーの重複登録と解除漏れを防ぐため、リスナーの登録と解除を1つの関数にまとめ、
        //      インタラクションが完了またはキャンセルされた際に必ず呼び出すように修正。
        let handleKeydown;
        let handleConfirm;
        let handleCancel;
        let recalculatePosition; // 追加

        // リスナーをすべて削除するクリーンアップ関数
        const cleanup = () => {
            document.removeEventListener('keydown', handleKeydown);
            confirmButton.removeEventListener('click', handleConfirm);
            cancelButton.removeEventListener('click', handleCancel);
            window.removeEventListener('resize', recalculatePosition); // 追加
            messageWindow.classList.add('hidden');
            if (uiStateContext) {
                uiStateContext.isPausedByModal = false;
            }
        };

        // --- リスナーの定義 ---
        // 確認ボタンが押されたときの処理
        handleConfirm = () => {
            cleanup(); // 全てのリスナーを削除
            world.emit('NPC_INTERACTED', npc); // バトルモードへ移行
        };

        // キャンセルボタンが押されたときの処理
        handleCancel = () => {
            cleanup(); // 全てのリスナーを削除
            // フォーカスをゲームキャンバスに戻す
            const canvas = document.getElementById('game-canvas');
            if (canvas) {
                canvas.focus();
            }
        };

        // キー入力があったときの処理
        handleKeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleConfirm();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                handleCancel();
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                // フォーカスを切り替える
                if (document.activeElement === confirmButton) {
                    cancelButton.focus();
                } else {
                    confirmButton.focus();
                }
            } else if (event.key === 'z' || event.key === 'Z') {
                event.preventDefault();
                event.stopPropagation(); // Zキーのイベントを他のリスナーに伝播させない
                // メッセージウィンドウ用のキー操作として消費されたことを示す
                input.pressedKeys.delete('z');
                // 現在のフォーカス要素に応じて処理を分岐
                if (document.activeElement === confirmButton) {
                    handleConfirm();
                } else if (document.activeElement === cancelButton) {
                    handleCancel();
                }
            }
        };

        // --- リスナーの登録 ---
        confirmButton.addEventListener('click', handleConfirm);
        cancelButton.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);

        // --- ウィンドウの表示 ---
        messageWindow.classList.remove('hidden');
        // デフォルトでOKボタンにフォーカス
        confirmButton.focus();

        // メッセージウィンドウの位置を動的に設定
        const canvas = document.getElementById('game-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const messageWindowRect = messageWindow.getBoundingClientRect();

        // メッセージウィンドウの下辺とマップ表示領域の下辺を揃える
        messageWindow.style.top = `${canvasRect.bottom - messageWindowRect.height}px`; // メッセージウィンドウの高さ分を引く
        messageWindow.style.left = `${canvasRect.left + (canvasRect.width / 2)}px`; // 横方向の中央揃え
        messageWindow.style.transform = 'translateX(-50%)';

        // ブラウザサイズ変更時にメッセージウィンドウの位置を再計算・再配置する関数
        recalculatePosition = () => { // letで宣言済みのため、constは不要
            const canvas = document.getElementById('game-canvas');
            const canvasRect = canvas.getBoundingClientRect();
            const messageWindowRect = messageWindow.getBoundingClientRect();

            messageWindow.style.top = `${canvasRect.bottom - messageWindowRect.height}px`;
            messageWindow.style.left = `${canvasRect.left + (canvasRect.width / 2)}px`;
            messageWindow.style.transform = 'translateX(-50%)';
        }; // cleanup関数内で使用するため、messageWindowなどの要素を参照可能

        // ブラウザサイズ変更イベントリスナーを登録
        window.addEventListener('resize', recalculatePosition);
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

    /**
     * Exports setup functions for external use (e.g., from customize scene).
     */
    window.MedarotJS = {
        setupMapMode,
        setupMapModeFromSave
    };

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
    
    // タイトル画面のセットアップ
    const titleContainer = document.getElementById('title-container');
    const startNewGameButton = document.getElementById('start-new-game');
    const startFromSaveButton = document.getElementById('start-from-save');

    // セーブデータの有無を確認
    if (localStorage.getItem('medarotJSaveData')) {
        startFromSaveButton.style.display = 'block';
    }

    startNewGameButton.addEventListener('click', async () => {
        await setupMapMode();
        titleContainer.classList.add('hidden');
        mapContainer.classList.remove('hidden');
        battleContainer.classList.add('hidden');
        console.log("Mode Switch: Map Exploration (New Game)");
        requestAnimationFrame(gameLoop);
    });

    startFromSaveButton.addEventListener('click', async () => {
        await setupMapModeFromSave();
        titleContainer.classList.add('hidden');
        mapContainer.classList.remove('hidden');
        battleContainer.classList.add('hidden');
        console.log("Mode Switch: Map Exploration (From Save)");
        requestAnimationFrame(gameLoop);
    });

    // タイトル画面を表示
    titleContainer.classList.remove('hidden');
    mapContainer.classList.add('hidden');
    battleContainer.classList.add('hidden');

    // セーブデータからマップをセットアップする関数
    async function setupMapModeFromSave() {
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

        // --- Create Game Context ---
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new GameModeContext()); // Create GameModeContext for map mode
        world.addComponent(contextEntity, new UIStateContext());
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'map';

        // --- Register Map Systems ---
        world.registerSystem(new PlayerInputSystem(world, input, map));
        world.registerSystem(new MovementSystem(world, map));
        world.registerSystem(new CameraSystem(world, camera, map));
        world.registerSystem(new MapRenderSystem(world, renderer, map, camera));

        // --- Load Player Position from Save Data ---
        const saveData = JSON.parse(localStorage.getItem('medarotJSaveData'));
        const savedX = saveData?.position?.x ?? 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2;
        const savedY = saveData?.position?.y ?? 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2;

        // --- Create Map Entities ---
        const playerEntityId = world.createEntity();
        const initialX = savedX;
        const initialY = savedY;

        world.addComponent(playerEntityId, new MapComponents.Position(initialX, initialY));
        world.addComponent(playerEntityId, new MapComponents.Velocity(0, 0));
        world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
        world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
        world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
        world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
        world.addComponent(playerEntityId, new MapComponents.FacingDirection('down'));

        // NOTE: world.reset()でリスナーがクリアされるため、マップモード設定時に再登録する
        world.on(MAP_EVENTS.BATTLE_TRIGGERED, switchToBattleMode);

        // Zキー入力によるバトルシーンへの移行処理
        world.on('NPC_INTERACTED', () => {
            console.log('NPC interacted, switching to battle mode');
            switchToBattleMode();
        });

        // NPCとのインタラクション要求イベント (メッセージウィンドウを表示するために追加)
        world.on('NPC_INTERACTION_REQUESTED', (npc) => {
            console.log('NPC interaction requested, showing message window');
            setupNpcInteractionModal(world, npc, input);
        });
    }

    // --- Game Screen Scaling ---
    // ウィンドウサイズに合わせてゲーム画面全体をスケーリングし、アスペクト比を維持する
    function applyScaling() {
        const baseWidth = BATTLE_CONFIG.SCALING.BASE_WIDTH; // ゲームの基準幅
        const baseHeight = BATTLE_CONFIG.SCALING.BASE_HEIGHT; // ゲームの基準高さ

        // 幅と高さのスケール値を計算し、小さい方を採用して画面内に収める
        const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);

        const transformStyle = `scale(${scale})`;
        
        // 既存のコンテナ定数に同じスケーリングを適用
        if (battleContainer) {
            battleContainer.style.transform = transformStyle;
        }
        if (mapContainer) {
            mapContainer.style.transform = transformStyle;
        }
    }

    // ウィンドウリサイズ時と初期ロード時にスケーリングを適用
    window.addEventListener('resize', applyScaling);
    applyScaling();


    window.focus();
});
