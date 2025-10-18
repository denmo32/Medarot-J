/**
 * @file BattleScene.js
 * @description バトルモードのセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from './BaseScene.js';
import { GameEvents } from '../battle/common/events.js';
import { initializeSystems } from '../battle/core/systemInitializer.js';
import { createPlayers } from '../battle/core/entityFactory.js';
import { GameModeContext } from '../battle/core/index.js';

/**
 * @typedef {import('../core/GameDataManager.js').GameDataManager} GameDataManager
 * @typedef {import('../core/InputManager.js').InputManager} InputManager
 */

/**
 * @typedef {object} BattleSceneData
 * @description BattleSceneの初期化に必要なデータ。
 * @property {GameDataManager} gameDataManager - グローバルなゲームデータマネージャー。
 * @property {InputManager} inputManager - グローバルな入力マネージャー。
 */

export class BattleScene extends BaseScene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    /**
     * @param {BattleSceneData} data - シーンの初期化データ。
     */
    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager, inputManager } = data; // ★ inputManagerも受け取る

        // --- Battle Systems & Entities Setup ---
        initializeSystems(this.world);

        const playerTeamData = gameDataManager.getPlayerDataForBattle();
        createPlayers(this.world, playerTeamData);

        const gameModeContext = this.world.getSingletonComponent(GameModeContext);
        if (gameModeContext) {
            gameModeContext.gameMode = 'battle';
        }

        // --- Event Listeners for Scene Transition ---
        this.world.on(GameEvents.GAME_OVER, (result) => {
            gameDataManager.applyBattleResult(result);
            // 3秒後にマップシーンへ移行
            // ★次のシーンに必要なデータをすべて渡す
            setTimeout(() => this.sceneManager.switchTo('map', { gameDataManager, inputManager }), 3000);
        });

        this.world.on(GameEvents.RESET_BUTTON_CLICKED, () => {
            // ★次のシーンに必要なデータをすべて渡す
            this.sceneManager.switchTo('map', { gameDataManager, inputManager });
        });

        // --- Start Battle Flow ---
        this.world.emit(GameEvents.SETUP_UI_REQUESTED);
        this.world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Battle Scene...");
        super.destroy();
    }
}