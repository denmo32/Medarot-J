/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 */
// Engineの新しいパスからインポート
import { World } from '../engine/core/World.js';
import { InputManager } from '../engine/input/InputManager.js';
import { SceneManager } from '../engine/scene/SceneManager.js';

import { TitleScene } from './scenes/TitleScene.js';
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
    // SceneManagerがシーン遷移時に自動的に hidden クラスを切り替える
    const containerMap = {
        title: document.getElementById('title-container'),
        map: document.getElementById('map-container'),
        battle: document.getElementById('battle-container'),
        customize: document.getElementById('customize-container'),
    };

    // シーンマネージャーのセットアップ
    const sceneManager = new SceneManager(world, containerMap);
    sceneManager.register('title', TitleScene);
    sceneManager.register('map', MapScene);
    sceneManager.register('battle', BattleScene);
    sceneManager.register('customize', CustomizeScene);

    // InputManagerの初期化
    const inputManager = new InputManager({
        keyMap: KEY_MAP,
        preventDefaultKeys: Object.keys(KEY_MAP)
    });

    // InputManagerを「永続コンポーネント」として登録
    sceneManager.registerPersistentComponent(inputManager);

    // SceneManagerにグローバルコンテキストを登録
    sceneManager.registerGlobalContext('gameDataManager', gameDataManager);

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
    
    // --- Game Screen Scaling ---
    function applyScaling() {
        const baseWidth = UI_CONFIG.SCALING.BASE_WIDTH;
        const baseHeight = UI_CONFIG.SCALING.BASE_HEIGHT;
        const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
        
        // 全てのコンテナにスケーリングを適用
        Object.values(containerMap).forEach(container => {
            if (container) {
                container.style.width = `${baseWidth}px`;
                container.style.height = `${baseHeight}px`;
                container.style.transform = `translate(-50%, -50%) scale(${scale})`;
            }
        });
    }

    window.addEventListener('resize', applyScaling);
    applyScaling();

    // --- Start Game ---
    // タイトルシーンから開始
    await sceneManager.switchTo('title');
    requestAnimationFrame(gameLoop);
    
    window.focus();
});