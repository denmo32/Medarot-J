/**
 * @file MapScene.js
 */
import { Scene } from '../../engine/scene/Scene.js';
import { MAP_EVENTS, CONFIG as MAP_CONFIG, PLAYER_STATES } from '../map/constants.js';
import { Camera } from '../../engine/graphics/Camera.js';
import { Renderer } from '../../engine/graphics/Renderer.js';
import { Map } from '../map/map.js';
import * as MapComponents from '../map/components.js';
import { PlayerInputSystem } from '../map/systems/PlayerInputSystem.js';
import { MovementSystem } from '../map/systems/MovementSystem.js';
import { CameraSystem } from '../map/systems/CameraSystem.js';
import { RenderSystem as MapRenderSystem } from '../map/systems/RenderSystem.js';
import { MapUISystem } from '../map/systems/MapUISystem.js';
import { InteractionSystem } from '../map/systems/InteractionSystem.js';
import { GameEvents } from '../common/events.js';

export class MapUIState {
    constructor() {
        this.isMapMenuVisible = false;
        this.isPausedByModal = false;
        this.modalJustOpened = false;
    }
}

export class MapScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
        this.mapData = null;
    }

    async init(data) {
        console.log("Initializing Map Scene...");
        const { gameDataManager, restoreMenu = false } = data;

        const { canvas, map } = await this._setupResources();
        this._setupContexts();
        const mapUISystem = this._setupSystems(canvas, map);
        const playerEntityId = this._setupEntities(gameDataManager);
        this._bindEvents(gameDataManager, playerEntityId);

        if (restoreMenu) {
            mapUISystem.toggleMenu();
        }
    }

    async _setupResources() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) throw new Error('Canvas element not found!');
        canvas.width = MAP_CONFIG.VIEWPORT_WIDTH;
        canvas.height = MAP_CONFIG.VIEWPORT_HEIGHT;
        
        if (!this.mapData) {
            const response = await fetch('scripts/map/map.json');
            this.mapData = await response.json();
        }
        const map = new Map(this.mapData);

        return { canvas, map };
    }

    _setupContexts() {
        const contextEntity = this.world.createEntity();
        const mapUIState = new MapUIState();
        this.world.addComponent(contextEntity, mapUIState);
    }

    _setupSystems(canvas, map) {
        const camera = new Camera();
        const renderer = new Renderer(canvas);

        const mapUISystem = new MapUISystem(this.world);
        this.world.registerSystem(new PlayerInputSystem(this.world, map));
        this.world.registerSystem(new MovementSystem(this.world, map));
        this.world.registerSystem(new CameraSystem(this.world, camera, map));
        this.world.registerSystem(new MapRenderSystem(this.world, renderer, map, camera));
        this.world.registerSystem(mapUISystem);
        this.world.registerSystem(new InteractionSystem(this.world, map));

        return mapUISystem;
    }

    _setupEntities(gameDataManager) {
        const playerEntityId = this.world.createEntity();
        const mapPlayerData = gameDataManager.gameData.playerPosition;
        
        this.world.addComponent(playerEntityId, new MapComponents.Position(mapPlayerData.x, mapPlayerData.y));
        this.world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
        this.world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
        this.world.addComponent(playerEntityId, new MapComponents.FacingDirection(mapPlayerData.direction));

        return playerEntityId;
    }

    _bindEvents(gameDataManager, playerEntityId) {
        const savePlayerState = () => {
            const pos = this.world.getComponent(playerEntityId, MapComponents.Position);
            const dir = this.world.getComponent(playerEntityId, MapComponents.FacingDirection);
            if (pos && dir) {
                gameDataManager.updatePlayerMapState({ x: pos.x, y: pos.y, direction: dir.direction });
            }
        };
        
        const switchTo = (sceneName, additionalData = {}) => {
            savePlayerState();
            this.sceneManager.switchTo(sceneName, { gameDataManager, ...additionalData });
        };

        this.world.on(MAP_EVENTS.BATTLE_TRIGGERED, () => switchTo('battle'));
        this.world.on(GameEvents.NPC_INTERACTED, () => switchTo('battle'));
        this.world.on(GameEvents.CUSTOMIZE_SCENE_REQUESTED, () => switchTo('customize'));

        this.world.on(GameEvents.GAME_SAVE_REQUESTED, () => {
            savePlayerState();
            gameDataManager.save();
        });
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Map Scene...");
        super.destroy();
    }
}