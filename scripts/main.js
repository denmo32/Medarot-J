/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 */
// シーン管理機構をインポート
import { SceneManager } from './scenes/SceneManager.js';
import { MapScene } from './scenes/MapScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { CustomizeScene } from './scenes/CustomizeScene.js';

import { World } from './engine/world.js';
import { InputManager } from './engine/InputManager.js';
import { GameDataManager } from './engine/GameDataManager.js';
import { UI_CONFIG } from './battle/common/UIConfig.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Global Instances ---
    const world = new World();
    const inputManager = new InputManager();
    const gameDataManager = new GameDataManager();

    // シーンマネージャーのセットアップ
    const sceneManager = new SceneManager(world);
    sceneManager.register('map', MapScene);
    sceneManager.register('battle', BattleScene);
    sceneManager.register('customize', CustomizeScene);

    // SceneManagerにグローバルコンテキストを登録
    sceneManager.registerGlobalContext('gameDataManager', gameDataManager);
    sceneManager.registerGlobalContext('inputManager', inputManager);

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

        // 蓄積された時間が固定ステップ以上ある間、論理更新を繰り返す
        // これにより、描画フレームレートが落ちてもゲームロジックの進行速度は一定に保たれる
        // また、1フレームでの移動量などが一定になり、すり抜け等のバグを防ぐ
        while (accumulator >= FIXED_TIME_STEP) {
            // SceneManagerに更新を委譲 (常に固定時間を渡す)
            sceneManager.update(FIXED_TIME_STEP);

            // 論理フレームの終わりに、そのフレームで処理された単発入力フラグ(justPressed等)をクリアする
            // これにより、1回のキー押しが複数の論理フレームで重複して処理されるのを防ぐ
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
            // 新規ゲーム開始時はセーブしない
        } else {
            gameDataManager.loadGame();
        }
        
        // switchToの呼び出しを簡潔化
        await sceneManager.switchTo('map');
        
        titleContainer.classList.add('hidden');
        inputManager.update(); // シーン切り替え直後の入力をリセット
        
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
