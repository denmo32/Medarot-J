/**
 * @file BattleScene.js
 * @description バトルシーンクラス。
 * HookContextの初期化を削除。
 */
import { Scene } from '../../engine/scene/Scene.js';
import { initializeSystems } from '../battle/setup/SystemInitializer.js';
import { createBattleTeam } from '../battle/setup/createBattleTeam.js';
import { createBattleContextEntities, createBattleUIContextEntity } from '../entities/createBattleContextEntities.js';

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
        createBattleTeam(this.world, playerTeamData);
    }

    _setupBattleContext() {
        createBattleContextEntities(this.world);
        createBattleUIContextEntity(this.world);
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Battle Scene...");
        super.destroy();
    }
}