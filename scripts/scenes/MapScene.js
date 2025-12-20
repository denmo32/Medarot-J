/**
 * @file MapScene.js
 * @description マップシーンクラス。
 * インポートパスを MapComponents.js に修正。
 */
import { Scene } from '../../engine/scene/Scene.js';
import { MAP_EVENTS, CONFIG as MAP_CONFIG, PLAYER_STATES } from '../map/constants.js';
import { Camera } from '../../engine/graphics/Camera.js';
import { Renderer } from '../../engine/graphics/Renderer.js';
import { Map } from '../map/map.js';
import * as MapComponents from '../map/MapComponents.js'; // パス修正
import { PlayerInputSystem } from '../map/systems/PlayerInputSystem.js';
import { MovementSystem } from '../map/systems/MovementSystem.js';
import { CameraSystem } from '../map/systems/CameraSystem.js';
import { MapRenderSystem } from '../map/systems/MapRenderSystem.js';
import { MapUISystem } from '../map/systems/MapUISystem.js';
import { InteractionSystem } from '../map/systems/InteractionSystem.js';
import { ToggleMenuRequest, GameSaveRequest } from '../map/components/MapRequests.js';
import { createPlayerEntity } from '../entities/createPlayerEntity.js';

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
        this.playerEntityId = null;
        this.gameDataManager = null;
    }

    async init(data) {
        const { gameDataManager, restoreMenu = false } = data;
        this.gameDataManager = gameDataManager;

        const { canvas, map } = await this._setupResources();
        this._setupContexts();
        
        // システム初期化
        const camera = new Camera();
        const renderer = new Renderer(canvas);

        this.world.registerSystem(new PlayerInputSystem(this.world, map));
        this.world.registerSystem(new MovementSystem(this.world, map));
        this.world.registerSystem(new CameraSystem(this.world, camera, map));
        this.world.registerSystem(new MapRenderSystem(this.world, renderer, map, camera));
        this.world.registerSystem(new MapUISystem(this.world));
        this.world.registerSystem(new InteractionSystem(this.world, map));

        this.playerEntityId = createPlayerEntity(this.world, gameDataManager);

        if (restoreMenu) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new ToggleMenuRequest());
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


    update(deltaTime) {
        super.update(deltaTime);
        
        // プレイヤー状態の保存処理
        const saveRequests = this.world.getEntitiesWith(GameSaveRequest);
        if (saveRequests.length > 0) {
            this._savePlayerState();
            this.gameDataManager.save();
            
            for (const id of saveRequests) {
                this.world.destroyEntity(id);
            }
        }
    }
    
    _savePlayerState() {
        if (this.playerEntityId !== null) {
            const pos = this.world.getComponent(this.playerEntityId, MapComponents.Position);
            const dir = this.world.getComponent(this.playerEntityId, MapComponents.FacingDirection);
            if (pos && dir) {
                this.gameDataManager.updatePlayerMapState({ x: pos.x, y: pos.y, direction: dir.direction });
            }
        }
    }

    destroy() {
        this._savePlayerState();
        super.destroy();
    }
}