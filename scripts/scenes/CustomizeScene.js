/**
 * @file CustomizeScene.js
 */
import { Scene } from '../../engine/scene/Scene.js';
import { CustomizeInputSystem } from '../customize/systems/CustomizeInputSystem.js';
import { CustomizeUISystem } from '../customize/systems/CustomizeUISystem.js';
import { CustomizeLogicSystem } from '../customize/systems/CustomizeLogicSystem.js';
import { CustomizeState } from '../customize/components/CustomizeState.js';
import { GameEvents } from '../common/events.js';

export class CustomizeScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
        this.gameDataManager = null;
    }

    init(data) {
        console.log("Initializing Customize Scene...");
        this.gameDataManager = data.gameDataManager;
        
        this._setupContexts();
        this._setupSystems();
        this._bindEvents();
    }

    _setupContexts() {
        const contextEntity = this.world.createEntity();
        this.world.addComponent(contextEntity, new CustomizeState());
    }

    _setupSystems() {
        // GameDataManagerをSystemに注入する
        this.world.registerSystem(new CustomizeUISystem(this.world, this.gameDataManager));
        this.world.registerSystem(new CustomizeInputSystem(this.world));
        this.world.registerSystem(new CustomizeLogicSystem(this.world, this.gameDataManager));
    }

    _bindEvents() {
        this.world.on(GameEvents.CUSTOMIZE_EXIT_REQUESTED, () => {
            this.sceneManager.switchTo('map', { restoreMenu: true });
        });
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Customize Scene...");
        const customizeUISystem = this.world.systems.find(s => s instanceof CustomizeUISystem);
        if (customizeUISystem && customizeUISystem.destroy) {
            customizeUISystem.destroy();
        }
        super.destroy();
    }
}