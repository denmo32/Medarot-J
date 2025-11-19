/**
 * @file CustomizeScene.js
 * @description カスタマイズ画面のセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from './BaseScene.js';
import { CustomizeInputSystem } from '../customize/systems/CustomizeInputSystem.js';
import { CustomizeUISystem } from '../customize/systems/CustomizeUISystem.js';
import { CustomizeLogicSystem } from '../customize/systems/CustomizeLogicSystem.js';
import { CustomizeState } from '../customize/components/CustomizeState.js';
import { GameEvents } from '../battle/common/events.js';

/**
 * @typedef {import('../core/GameDataManager.js').GameDataManager} GameDataManager
 * @typedef {import('../core/InputManager.js').InputManager} InputManager
 */

/**
 * @typedef {object} CustomizeSceneData
 * @description CustomizeSceneの初期化に必要なデータ。
 * @property {GameDataManager} gameDataManager - グローバルなゲームデータマネージャー。
 * @property {InputManager} inputManager - グローバルな入力マネージャー。
 */

export class CustomizeScene extends BaseScene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    /**
     * @param {CustomizeSceneData} data - シーンの初期化データ。
     */
    init(data) {
        console.log("Initializing Customize Scene...");
        // initで渡されるgameDataManager, inputManagerはローカル変数として使用
        const { gameDataManager, inputManager } = data;

        // --- Contexts and State ---
        // カスタマイズシーンはバトルと状態を共有しないため、独自のコンポーネントのみを使用します。
        const contextEntity = this.world.createEntity();
        this.world.addComponent(contextEntity, new CustomizeState());
        
        // --- Systems ---
        const customizeUISystem = new CustomizeUISystem(this.world);
        const customizeInputSystem = new CustomizeInputSystem(this.world);
        const customizeLogicSystem = new CustomizeLogicSystem(this.world);
        
        this.world.registerSystem(customizeUISystem);
        this.world.registerSystem(customizeInputSystem);
        this.world.registerSystem(customizeLogicSystem);

        // --- Event Listeners for Scene Transition ---
        this.world.on(GameEvents.CUSTOMIZE_EXIT_REQUESTED, () => {
            // 前のシーン（マップ）に戻る
            // switchToの呼び出しを簡潔化
            this.sceneManager.switchTo('map', { restoreMenu: true });
        });
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Customize Scene...");
        // CustomizeUISystemがDOMを非表示にする処理を持つ
        const customizeUISystem = this.world.systems.find(s => s instanceof CustomizeUISystem);
        if (customizeUISystem && customizeUISystem.destroy) {
            customizeUISystem.destroy();
        }
        super.destroy();
    }
}