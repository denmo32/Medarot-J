/**
 * @file BattleScene.js
 * @description バトルシーンクラス。
 * HookContextの初期化を削除。
 */
import { Scene } from '../../engine/scene/Scene.js';
import { initializeSystems } from '../battle/setup/SystemInitializer.js';
import { createPlayers } from '../battle/setup/EntityFactory.js';
import { TurnContext } from '../battle/components/TurnContext.js';
import { PhaseState } from '../battle/components/PhaseState.js';
import { BattleHistoryContext } from '../battle/components/BattleHistoryContext.js';
import { BattleUIState } from '../battle/components/BattleUIState.js';
import { UIManager } from '../../engine/ui/UIManager.js';

export class BattleScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager } = data;

        this._setupEntities(gameDataManager);
        this._setupBattleContext();
        this._setupSystems(gameDataManager);
    }

    _setupSystems(gameDataManager) {
        initializeSystems(this.world, gameDataManager);
    }

    _setupEntities(gameDataManager) {
        const playerTeamData = gameDataManager.gameData.playerMedarots;
        createPlayers(this.world, playerTeamData);
    }

    _setupBattleContext() {
        const contextEntity = this.world.createEntity();

        this.world.addComponent(contextEntity, new TurnContext());
        this.world.addComponent(contextEntity, new PhaseState());
        this.world.addComponent(contextEntity, new BattleHistoryContext());
        // HookContext は廃止されたため削除

        const uiContextEntity = this.world.createEntity();
        this.world.addComponent(uiContextEntity, new BattleUIState());
        this.world.addComponent(uiContextEntity, new UIManager());
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Battle Scene...");
        super.destroy();
    }
}