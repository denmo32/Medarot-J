/**
 * @file BattleScene.js
 * @description バトルモードのセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from './BaseScene.js';
import { GameEvents } from '../battle/common/events.js';
import { initializeSystems } from '../battle/core/systemInitializer.js';
import { createPlayers } from '../battle/core/entityFactory.js';
import { BattleContext } from '../battle/core/index.js';

export class BattleScene extends BaseScene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    /**
     * @param {BattleSceneData} data - シーンの初期化データ。
     */
    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager, inputManager } = data;

        this._setupSystems();
        this._setupEntities(gameDataManager);
        this._setupBattleContext();
        this._bindEvents(gameDataManager);

        // --- Start Battle Flow ---
        this.world.emit(GameEvents.SETUP_UI_REQUESTED);
        this.world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    /**
     * バトルに必要なシステム群を初期化・登録します。
     * @private
     */
    _setupSystems() {
        initializeSystems(this.world);
    }

    /**
     * プレイヤーおよび敵エンティティを生成します。
     * @param {GameDataManager} gameDataManager 
     * @private
     */
    _setupEntities(gameDataManager) {
        const playerTeamData = gameDataManager.getPlayerDataForBattle();
        createPlayers(this.world, playerTeamData);
    }

    /**
     * バトルコンテキストの初期設定を行います。
     * @private
     */
    _setupBattleContext() {
        // 新しいBattleContextが初期化時にgameModeを'battle'に設定するため、
        // ここでの明示的な設定は本来不要ですが、意図を明確にするために残しています。
        const battleContext = this.world.getSingletonComponent(BattleContext);
        if (battleContext) {
            battleContext.gameMode = 'battle';
        }
    }

    /**
     * シーン固有のイベントリスナーを設定します。
     * @param {GameDataManager} gameDataManager 
     * @private
     */
    _bindEvents(gameDataManager) {
        // ゲーム終了後の処理とシーン遷移要求を分離
        this.world.on(GameEvents.SCENE_CHANGE_REQUESTED, (detail) => {
            // このシーンで発生した戦闘結果をゲームデータに反映
            if (detail.data && detail.data.result) {
                gameDataManager.applyBattleResult(detail.data.result);
            }
            // シーン切り替え
            this.sceneManager.switchTo(detail.sceneName, detail.data);
        });

        // UIからのリセットボタンクリックを処理
        this.world.on(GameEvents.RESET_BUTTON_CLICKED, () => {
            // 即座にマップシーンへの遷移を要求
            this.world.emit(GameEvents.SCENE_CHANGE_REQUESTED, {
                sceneName: 'map',
                data: {} 
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