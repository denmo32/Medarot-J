/**
 * @file BattleScene.js
 * @description バトルモードのセットアップとロジックをカプセル化するシーンクラス。
 */
import { Scene } from '../../engine/scene/Scene.js'; // BaseScene -> Scene
import { GameEvents } from '../common/events.js';
import { initializeSystems, createPlayers, BattleContext } from '../battle/context/index.js';

export class BattleScene extends Scene { // extends Scene
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    /**
     * @param {object} data - シーンの初期化データ。
     */
    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager } = data;

        this._setupSystems();
        this._setupEntities(gameDataManager);
        this._setupBattleContext();
        this._bindEvents(gameDataManager);

        // --- Start Battle Flow ---
        this.world.emit(GameEvents.SETUP_UI_REQUESTED);
        this.world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    _setupSystems() {
        initializeSystems(this.world);
    }

    _setupEntities(gameDataManager) {
        const playerTeamData = gameDataManager.getPlayerDataForBattle();
        createPlayers(this.world, playerTeamData);
    }

    _setupBattleContext() {
        const battleContext = this.world.getSingletonComponent(BattleContext);
        if (battleContext) {
            battleContext.gameMode = 'battle';
        }
    }

    _bindEvents(gameDataManager) {
        this.world.on(GameEvents.SCENE_CHANGE_REQUESTED, (detail) => {
            if (detail.data && detail.data.result) {
                gameDataManager.applyBattleResult(detail.data.result);
            }
            this.sceneManager.switchTo(detail.sceneName, detail.data);
        });

        this.world.on(GameEvents.RESET_BUTTON_CLICKED, () => {
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