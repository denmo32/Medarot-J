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
import { InputManager } from './core/InputManager.js';
import * as MapComponents from './map/components.js';
import { PlayerInputSystem } from './map/systems/PlayerInputSystem.js';
import { MovementSystem } from './map/systems/MovementSystem.js';
import { CameraSystem } from './map/systems/CameraSystem.js';
import { RenderSystem as MapRenderSystem } from './map/systems/RenderSystem.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Global World Instance ---
    const world = new World();

    // --- Global Input Manager ---
    const inputManager = new InputManager();

    // --- UI Elements ---
    const mapContainer = document.getElementById('map-container');
    const battleContainer = document.getElementById('battle-container');

    // ★ 変更: 永続化するエンティティのデータを保存する変数
    let persistentEntityData = null;

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
        world.addComponent(contextEntity, new GameModeContext()); // Create GameModeContext for map mode
        world.addComponent(contextEntity, new UIStateContext());
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'map';

        // --- Register Map Systems ---
        const playerInputSystem = new PlayerInputSystem(world, inputManager, map);
        world.registerSystem(playerInputSystem);
        world.registerSystem(new MovementSystem(world, map));
        world.registerSystem(new CameraSystem(world, camera, map));
        world.registerSystem(new MapRenderSystem(world, renderer, map, camera));

        // --- Create Map Entities ---
        const playerEntityId = world.createEntity();

        // ★ 変更: 永続化データがあれば、それを使ってエンティティを復元
        if (persistentEntityData) {
            for (const component of persistentEntityData) {
                world.addComponent(playerEntityId, component);
            }
            persistentEntityData = null; // 使用後はリセット
        } else {
            // 永続化データがない場合（新規ゲームなど）はデフォルトで作成
            const initialX = 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2;
            const initialY = 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2;

            world.addComponent(playerEntityId, new MapComponents.Position(initialX, initialY));
            world.addComponent(playerEntityId, new MapComponents.Velocity(0, 0));
            world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
            world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
            world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
            world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
            world.addComponent(playerEntityId, new MapComponents.FacingDirection('down'));
        }

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
            setupNpcInteractionModal(world, npc);
        });

        // ★新規: カスタマイズシーンへの遷移要求をリッスン
        world.on('CUSTOMIZE_SCENE_REQUESTED', switchToCustomizeMode);

        // ★追加: オプションに基づいてメニューを復元
        if (options.restoreMenu) {
            playerInputSystem.toggleMenu();
        }
    }

    /**
     * Displays the NPC interaction modal and handles user input.
     * @param {World} world - The game world instance.
     * @param {object} npc - The NPC object that triggered the interaction.
     * @param {InputHandler} input - The input handler instance.
     */
    function setupNpcInteractionModal(world, npc) {
        const messageWindow = document.getElementById('interaction-message-window');
        const confirmButton = document.getElementById('confirm-battle-button');
        const cancelButton = document.getElementById('cancel-battle-button');
        const uiStateContext = world.getSingletonComponent(UIStateContext);

        if (uiStateContext) {
            uiStateContext.isPausedByModal = true;
            uiStateContext.modalJustOpened = true;
        }

        let handleConfirm;
        let handleCancel;
        let recalculatePosition;

        const cleanup = () => {
            confirmButton.removeEventListener('click', handleConfirm);
            cancelButton.removeEventListener('click', handleCancel);
            window.removeEventListener('resize', recalculatePosition);
            messageWindow.classList.add('hidden');
            if (uiStateContext) {
                uiStateContext.isPausedByModal = false;
            }
        };

        handleConfirm = () => {
            cleanup();
            world.emit('NPC_INTERACTED', npc);
        };

        handleCancel = () => {
            cleanup();
            const canvas = document.getElementById('game-canvas');
            if (canvas) {
                canvas.focus();
            }
        };

        confirmButton.addEventListener('click', handleConfirm);
        cancelButton.addEventListener('click', handleCancel);

        messageWindow.classList.remove('hidden');
        confirmButton.focus();

        recalculatePosition = () => {
            const canvas = document.getElementById('game-canvas');
            const canvasRect = canvas.getBoundingClientRect();
            const messageWindowRect = messageWindow.getBoundingClientRect();

            messageWindow.style.top = `${canvasRect.bottom - messageWindowRect.height}px`;
            messageWindow.style.left = `${canvasRect.left + (canvasRect.width / 2)}px`;
            messageWindow.style.transform = 'translateX(-50%)';
        };

        recalculatePosition();
        window.addEventListener('resize', recalculatePosition);
    }

    // ★新規: カスタマイズシーンへの遷移とセットアップ
    function switchToCustomizeMode() {
        console.log("Mode Switch: Customize");

        // プレイヤーエンティティの全コンポーネントを保存
        const playerEntities = world.getEntitiesWith(MapComponents.PlayerControllable);
        if (playerEntities.length > 0) {
            const playerEntityId = playerEntities[0];
            const componentClasses = world.entities.get(playerEntityId);
            if (componentClasses) {
                persistentEntityData = [];
                for (const componentClass of componentClasses) {
                    const componentInstance = world.getComponent(playerEntityId, componentClass);
                    if (componentInstance) {
                        persistentEntityData.push(componentInstance);
                    }
                }
            }
        }
        
        // カスタマイズシーンのセットアップを実行
        setupCustomizeScene();
    }

    function setupCustomizeScene() {
        // ワールドをリセット
        world.reset();
        
        // 必要なコンテキストを再作成
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new GameModeContext());
        world.addComponent(contextEntity, new UIStateContext());
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'customize';

        // UIの表示切り替え
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

        // マップに戻るためのキー入力ハンドラ
        const handleCustomizeKeyDown = (event) => {
            if (event.key === 'x' || event.key === 'X') {
                window.removeEventListener('keydown', handleCustomizeKeyDown);
                
                // customizeContainerを非表示にする
                const customizeContainer = document.getElementById('customize-container');
                if (customizeContainer) {
                    customizeContainer.classList.add('hidden');
                }
                
                // マップモードに切り替える
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
        });
    }

    /**
     * Switches the game to battle mode.
     */
    function switchToBattleMode() {
        console.log("Mode Switch: Battle");

        // ★ 変更: プレイヤーエンティティの全コンポーネントを保存
        const playerEntities = world.getEntitiesWith(MapComponents.PlayerControllable);
        if (playerEntities.length > 0) {
            const playerEntityId = playerEntities[0];
            const componentClasses = world.entities.get(playerEntityId);
            if (componentClasses) {
                persistentEntityData = [];
                for (const componentClass of componentClasses) {
                    const componentInstance = world.getComponent(playerEntityId, componentClass);
                    if (componentInstance) {
                        persistentEntityData.push(componentInstance);
                    }
                }
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

        // --- Handle global inputs for modals ---
        const uiStateContext = world.getSingletonComponent(UIStateContext);
        if (uiStateContext && uiStateContext.isPausedByModal) {
            // モーダルが開いたフレームでは入力を無視する
            if (uiStateContext.modalJustOpened) {
                uiStateContext.modalJustOpened = false;
            } else {
                const messageWindow = document.getElementById('interaction-message-window');
                if (!messageWindow.classList.contains('hidden')) {
                    const confirmButton = document.getElementById('confirm-battle-button');
                    const cancelButton = document.getElementById('cancel-battle-button');

                    // 方向キーでフォーカスを切り替え
                    if (inputManager.wasKeyJustPressed('ArrowLeft') || inputManager.wasKeyJustPressed('ArrowRight') || inputManager.wasKeyJustPressed('ArrowUp') || inputManager.wasKeyJustPressed('ArrowDown')) {
                        if (document.activeElement === confirmButton) {
                            cancelButton.focus();
                        } else {
                            confirmButton.focus();
                        }
                    }

                    // Zキーで決定
                    if (inputManager.wasKeyJustPressed('z')) {
                        if (document.activeElement instanceof HTMLButtonElement) {
                            document.activeElement.click();
                        } else {
                            confirmButton.click();
                        }
                    }

                    // Xキーでキャンセル
                    if (inputManager.wasKeyJustPressed('x')) {
                        cancelButton.click();
                    }
                }
            }
        }

        // Update input manager for the next frame
        inputManager.update();

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
        await setupMapModeFromSave({});
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
    async function setupMapModeFromSave(options = {}) {
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
        world.addComponent(contextEntity, new GameModeContext()); // Create GameModeContext for map mode
        world.addComponent(contextEntity, new UIStateContext());
        const gameModeContext = world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'map';

        // --- Register Map Systems ---
        const playerInputSystem = new PlayerInputSystem(world, inputManager, map);
        world.registerSystem(playerInputSystem);
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
            setupNpcInteractionModal(world, npc);
        });

        // ★新規: カスタマイズシーンへの遷移要求をリッスン
        world.on('CUSTOMIZE_SCENE_REQUESTED', switchToCustomizeMode);

        // ★追加: オプションに基づいてメニューを復元
        if (options.restoreMenu) {
            playerInputSystem.toggleMenu();
        }
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

            // focusedIndex が表示されているボタンの範囲に収まるように調整
            focusedIndex = Math.max(0, Math.min(focusedIndex, visibleButtons.length - 1));

            visibleButtons.forEach((btn, index) => {
                if (index === focusedIndex) {
                    btn.focus();
                }
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
        
        // 初期フォーカスを設定
        // セーブボタンが表示されているかどうかにかかわらず、最初の表示ボタンにフォーカス
        const visibleButtons = buttons.filter(btn => btn && btn.style.display !== 'none');
        if (visibleButtons.length > 0) {
            focusedIndex = 0;
            updateFocus();
        }
    }

    setupTitleScreenInput();

    window.focus();
});
