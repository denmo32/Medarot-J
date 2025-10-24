/**
 * @file BattleScene.js
 * @description バトルモードのセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from './BaseScene.js';
import { GameEvents } from '../battle/common/events.js';
import { initializeSystems } from '../battle/core/systemInitializer.js';
import { createPlayers } from '../battle/core/entityFactory.js';
import { BattleContext } from '../battle/core/index.js';

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
        // シーン間で受け渡すデータを保持するためのプロパティ
        this.gameDataManager = null;
        this.inputManager = null;
    }

    /**
     * @param {BattleSceneData} data - シーンの初期化データ。
     */
    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager, inputManager } = data;
        // gameDataManagerとinputManagerをインスタンスプロパティとして保持
        this.gameDataManager = gameDataManager;
        this.inputManager = inputManager;

        // --- Battle Systems & Entities Setup ---
        initializeSystems(this.world);

        const playerTeamData = gameDataManager.getPlayerDataForBattle();
        createPlayers(this.world, playerTeamData);

        // 新しいBattleContextが初期化時にgameModeを'battle'に設定するため、
        // ここでの明示的な設定は不要になりますが、念のため残しておきます。
        const battleContext = this.world.getSingletonComponent(BattleContext);
        if (battleContext) {
            battleContext.gameMode = 'battle';
        }

        // シーン遷移の責務をイベントハンドラに集約
        this.bindSceneTransitionEvents();

        // --- Start Battle Flow ---
        this.world.emit(GameEvents.SETUP_UI_REQUESTED);
        this.world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    /**
     * シーン遷移に関連するイベントリスナーをここに集約します。
     */
    bindSceneTransitionEvents() {
        // ゲーム終了後の処理とシーン遷移要求を分離
        this.world.on(GameEvents.SCENE_CHANGE_REQUESTED, (detail) => {
            // このシーンで発生した戦闘結果をゲームデータに反映
            if (detail.data && detail.data.result) {
                this.gameDataManager.applyBattleResult(detail.data.result);
            }
            // 次のシーンに必要なグローバルインスタンスを渡して遷移
            this.sceneManager.switchTo(detail.sceneName, {
                gameDataManager: this.gameDataManager,
                inputManager: this.inputManager
            });
        });

        // UIからのリセットボタンクリックを処理
        this.world.on(GameEvents.RESET_BUTTON_CLICKED, () => {
            // タイマーなしで即座にマップシーンへの遷移を要求
            this.world.emit(GameEvents.SCENE_CHANGE_REQUESTED, {
                sceneName: 'map',
                data: {} // この場合は特に渡すデータなし
            });
        });
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Battle Scene...");
        super.destroy();
    }
}