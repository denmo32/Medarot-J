/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 */
import { World } from './engine/world.js';
import { InputManager } from './engine/InputManager.js';
import { SceneManager } from './engine/SceneManager.js';

import { MapScene } from './scenes/MapScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { CustomizeScene } from './scenes/CustomizeScene.js';

import { GameDataManager } from './managers/GameDataManager.js';
import { UI_CONFIG } from './battle/common/UIConfig.js';

// ゲーム固有のキー設定をインポート
import { KEY_MAP } from './map/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Global Instances ---
    const world = new World();
    
    const gameDataManager = new GameDataManager();

    // DOMコンテナのマッピングを定義
    const containerMap = {
        map: document.getElementById('map-container'),
        battle: document.getElementById('battle-container'),
        customize: document.getElementById('customize-container'),
    };

    // シーンマネージャーのセットアップ
    const sceneManager = new SceneManager(world, containerMap);
    sceneManager.register('map', MapScene);
    sceneManager.register('battle', BattleScene);
    sceneManager.register('customize', CustomizeScene);

    // InputManagerの初期化
    const inputManager = new InputManager({
        keyMap: KEY_MAP,
        preventDefaultKeys: Object.keys(KEY_MAP)
    });

    // InputManagerを「永続コンポーネント」として登録
    // これにより、シーン遷移（Worldリセット）後も自動的にWorldに再追加される
    sceneManager.registerPersistentComponent(inputManager);

    // SceneManagerにグローバルコンテキストを登録
    // （initメソッドの引数として渡したいデータがあればここに追加）
    sceneManager.registerGlobalContext('gameDataManager', gameDataManager);

    // --- UI Elements ---
    const titleContainer = document.getElementById('title-container');
    const startNewGameButton = document.getElementById('start-new-game');
    const startFromSaveButton = document.getElementById('start-from-save');

    // --- Main Game Loop ---
    // 固定タイムステップ設定 (60 FPS)
    const FIXED_TIME_STEP = 1000 / 60;
    let lastTime = 0;
    let accumulator = 0;

    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // 経過時間を蓄積
        accumulator += deltaTime;

        while (accumulator >= FIXED_TIME_STEP) {
            sceneManager.update(FIXED_TIME_STEP);
            inputManager.update();
            accumulator -= FIXED_TIME_STEP;
        }

        requestAnimationFrame(gameLoop);
    }
    
    // --- Initial Setup ---
    if (localStorage.getItem('medarotJSaveData')) {
        startFromSaveButton.style.display = 'block';
    }

    const startGame = async (isNewGame) => {
        if (isNewGame) {
            gameDataManager.resetToDefault();
        } else {
            gameDataManager.loadGame();
        }
        
        await sceneManager.switchTo('map');
        
        titleContainer.classList.add('hidden');
        inputManager.update();
        
        console.log(`Mode Switch: Map Exploration (${isNewGame ? 'New Game' : 'From Save'})`);
        requestAnimationFrame(gameLoop);
    };

    startNewGameButton.addEventListener('click', () => startGame(true));
    startFromSaveButton.addEventListener('click', () => startGame(false));

    titleContainer.classList.remove('hidden');

    // --- Game Screen Scaling ---
    function applyScaling() {
        const baseWidth = UI_CONFIG.SCALING.BASE_WIDTH;
        const baseHeight = UI_CONFIG.SCALING.BASE_HEIGHT;
        const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
        
        const containers = [
            document.getElementById('battle-container'),
            document.getElementById('map-container'),
            document.getElementById('customize-container')
        ];
        
        containers.forEach(container => {
            if (container) {
                container.style.width = `${baseWidth}px`;
                container.style.height = `${baseHeight}px`;
                container.style.transform = `translate(-50%, -50%) scale(${scale})`;
            }
        });
    }

    window.addEventListener('resize', applyScaling);
    applyScaling();

    // --- Title Screen Input ---
    function setupTitleScreenInput() {
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