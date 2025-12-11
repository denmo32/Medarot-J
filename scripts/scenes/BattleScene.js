/**
 * @file BattleScene.js
 */
import { Scene } from '../../engine/scene/Scene.js';
import { GameEvents } from '../common/events.js';
import { initializeSystems } from '../battle/setup/SystemInitializer.js';
import { createPlayers } from '../battle/setup/EntityFactory.js';
import { BattleContext } from '../battle/components/BattleContext.js';

export class BattleScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager } = data;

        this._setupSystems(gameDataManager);
        this._setupEntities(gameDataManager);
        this._setupBattleContext();
        this._bindEvents(gameDataManager);

        this.world.emit(GameEvents.SETUP_UI_REQUESTED);
        this.world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    _setupSystems(gameDataManager) {
        initializeSystems(this.world, gameDataManager);
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