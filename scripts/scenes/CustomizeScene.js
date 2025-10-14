/**
 * @file CustomizeScene.js
 * @description カスタマイズ画面のセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from './BaseScene.js';
import { CustomizeSystem } from '../customize/CustomizeSystem.js';
import { GameModeContext, UIStateContext } from '../battle/core/index.js';

export class CustomizeScene extends BaseScene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    init(data) {
        console.log("Initializing Customize Scene...");
        const { gameDataManager, inputManager } = data; // ★修正: inputManagerも受け取る

        // --- Contexts ---
        const contextEntity = this.world.createEntity();
        this.world.addComponent(contextEntity, new GameModeContext());
        this.world.addComponent(contextEntity, new UIStateContext());
        const gameModeContext = this.world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'customize';

        // --- Systems ---
        const customizeSystem = new CustomizeSystem(this.world);
        this.world.registerSystem(customizeSystem);

        // --- Event Listeners for Scene Transition ---
        this.world.on('CUSTOMIZE_EXIT_REQUESTED', () => {
            // 前のシーン（マップ）に戻る
            // ★修正: 次のシーンに必要なデータをすべて渡す
            this.sceneManager.switchTo('map', { gameDataManager, inputManager, restoreMenu: true });
        });
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Customize Scene...");
        // CustomizeSystemがDOMを非表示にする処理を持つ場合、ここで呼び出す
        const customizeSystem = this.world.systems.find(s => s instanceof CustomizeSystem);
        if (customizeSystem && customizeSystem.destroy) {
            customizeSystem.destroy();
        }
        super.destroy();
    }
}