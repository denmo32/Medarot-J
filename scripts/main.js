/**
 * @file アプリケーションのエントリーポイント
 */
import { World } from '../engine/core/World.js';
import { InputManager } from '../engine/input/InputManager.js';
import { SceneManager } from '../engine/scene/SceneManager.js';

import { TitleScene } from './scenes/TitleScene.js';
import { MapScene } from './scenes/MapScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { CustomizeScene } from './scenes/CustomizeScene.js';

import { GameDataManager } from './managers/GameDataManager.js';
import { UI_CONFIG } from './battle/common/UIConfig.js';

import { KEY_MAP } from './map/constants.js';

document.addEventListener('DOMContentLoaded', async () => {
    const world = new World();
    
    const gameDataManager = new GameDataManager();

    const containerMap = {
        title: document.getElementById('title-container'),
        map: document.getElementById('map-container'),
        battle: document.getElementById('battle-container'),
        customize: document.getElementById('customize-container'),
    };

    const sceneManager = new SceneManager(world, containerMap);
    sceneManager.register('title', TitleScene);
    sceneManager.register('map', MapScene);
    sceneManager.register('battle', BattleScene);
    sceneManager.register('customize', CustomizeScene);

    const inputManager = new InputManager({
        keyMap: KEY_MAP,
        preventDefaultKeys: Object.keys(KEY_MAP)
    });

    sceneManager.registerPersistentComponent(inputManager);

    sceneManager.registerGlobalContext('gameDataManager', gameDataManager);

    const FIXED_TIME_STEP = 1000 / 60;
    let lastTime = 0;
    let accumulator = 0;

    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        accumulator += deltaTime;

        while (accumulator >= FIXED_TIME_STEP) {
            sceneManager.update(FIXED_TIME_STEP);
            inputManager.update();
            accumulator -= FIXED_TIME_STEP;
        }

        requestAnimationFrame(gameLoop);
    }
    
    function applyScaling() {
        const baseWidth = UI_CONFIG.SCALING.BASE_WIDTH;
        const baseHeight = UI_CONFIG.SCALING.BASE_HEIGHT;
        const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
        
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

    await sceneManager.switchTo('title');
    requestAnimationFrame(gameLoop);
    
    window.focus();
});