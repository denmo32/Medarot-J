/**
 * @file CustomizeScene.js
 * @description カスタマイズシーンクラス。
 * イベント発行を廃止。
 */
import { Scene } from '../../engine/scene/Scene.js';
import { CustomizeInputSystem } from '../customize/systems/CustomizeInputSystem.js';
import { CustomizeUISystem } from '../customize/systems/CustomizeUISystem.js';
import { CustomizeLogicSystem } from '../customize/systems/CustomizeLogicSystem.js';
import { createCustomizeContextEntity } from '../entities/createCustomizeContextEntity.js';

export class CustomizeScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
        this.gameDataManager = null;
    }

    init(data) {
        this.gameDataManager = data.gameDataManager;
        
        this._setupContexts();
        this._setupSystems();
    }

    _setupContexts() {
        createCustomizeContextEntity(this.world);
    }

    _setupSystems() {
        this.world.registerSystem(new CustomizeUISystem(this.world, this.gameDataManager));
        this.world.registerSystem(new CustomizeInputSystem(this.world));
        this.world.registerSystem(new CustomizeLogicSystem(this.world, this.gameDataManager));
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        const customizeUISystem = this.world.systems.find(s => s instanceof CustomizeUISystem);
        if (customizeUISystem && customizeUISystem.destroy) {
            customizeUISystem.destroy();
        }
        super.destroy();
    }
}
