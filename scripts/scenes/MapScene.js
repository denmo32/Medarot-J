/**
 * @file MapScene.js
 * @description マップ探索モードのセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from './BaseScene.js';
import { GameModeContext, UIStateContext } from '../battle/core/index.js';
import { MAP_EVENTS, CONFIG as MAP_CONFIG, PLAYER_STATES } from '../map/constants.js';
import { Camera } from '../map/camera.js';
import { Renderer } from '../map/renderer.js';
import { Map } from '../map/map.js';
import * as MapComponents from '../map/components.js';
import { PlayerInputSystem } from '../map/systems/PlayerInputSystem.js';
import { MovementSystem } from '../map/systems/MovementSystem.js';
import { CameraSystem } from '../map/systems/CameraSystem.js';
import { RenderSystem as MapRenderSystem } from '../map/systems/RenderSystem.js';
import { MapUISystem } from '../map/systems/MapUISystem.js';

/**
 * @typedef {import('../core/GameDataManager.js').GameDataManager} GameDataManager
 * @typedef {import('../core/InputManager.js').InputManager} InputManager
 */

/**
 * @typedef {object} MapSceneData
 * @description MapSceneの初期化に必要なデータ。
 * @property {GameDataManager} gameDataManager - グローバルなゲームデータマネージャー。
 * @property {InputManager} inputManager - グローバルな入力マネージャー。
 * @property {boolean} [restoreMenu=false] - シーン開始時にメニューを開いた状態にするか。
 */

export class MapScene extends BaseScene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
        this.mapData = null; // マップデータをキャッシュ
    }

    /**
     * @param {MapSceneData} data - シーンの初期化データ。
     */
    async init(data) {
        console.log("Initializing Map Scene...");
        const { gameDataManager, inputManager, restoreMenu = false } = data;

        // --- Canvas Setup ---
        const canvas = document.getElementById('game-canvas');
        if (!canvas) throw new Error('Canvas element not found!');
        canvas.width = MAP_CONFIG.VIEWPORT_WIDTH;
        canvas.height = MAP_CONFIG.VIEWPORT_HEIGHT;
        
        // --- Map Mode Objects ---
        const camera = new Camera();
        const renderer = new Renderer(canvas);
        if (!this.mapData) {
            const response = await fetch('scripts/map/map.json');
            this.mapData = await response.json();
        }
        const map = new Map(this.mapData);

        // --- Contexts ---
        const contextEntity = this.world.createEntity();
        this.world.addComponent(contextEntity, new GameModeContext());
        const uiStateContext = new UIStateContext();
        this.world.addComponent(contextEntity, uiStateContext);
        uiStateContext.isMapMenuVisible = false;
        uiStateContext.isPausedByModal = false;
        uiStateContext.modalJustOpened = false;

        // --- Systems ---
        const mapUISystem = new MapUISystem(this.world, inputManager);
        this.world.registerSystem(new PlayerInputSystem(this.world, inputManager, map));
        this.world.registerSystem(new MovementSystem(this.world, map));
        this.world.registerSystem(new CameraSystem(this.world, camera, map));
        this.world.registerSystem(new MapRenderSystem(this.world, renderer, map, camera));
        this.world.registerSystem(mapUISystem);

        const gameModeContext = this.world.getSingletonComponent(GameModeContext);
        gameModeContext.gameMode = 'map';

        // --- Entities ---
        const playerEntityId = this.world.createEntity();
        const mapPlayerData = gameDataManager.getPlayerDataForMap();
        this.world.addComponent(playerEntityId, new MapComponents.Position(mapPlayerData.position.x, mapPlayerData.position.y));
        this.world.addComponent(playerEntityId, new MapComponents.Velocity(0, 0));
        this.world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
        this.world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
        this.world.addComponent(playerEntityId, new MapComponents.FacingDirection('down'));

        // --- Event Listeners for Scene Transition ---
        const savePlayerPosition = () => {
            const pos = this.world.getComponent(playerEntityId, MapComponents.Position);
            if (pos) gameDataManager.updatePlayerPosition(pos.x, pos.y);
        };
        
        this.world.on(MAP_EVENTS.BATTLE_TRIGGERED, () => {
            savePlayerPosition();
            // ★修正: 次のシーンに必要なデータをすべて渡す
            this.sceneManager.switchTo('battle', { gameDataManager, inputManager });
        });
        this.world.on('NPC_INTERACTED', () => {
            savePlayerPosition();
            // ★修正: 次のシーンに必要なデータをすべて渡す
            this.sceneManager.switchTo('battle', { gameDataManager, inputManager });
        });
        this.world.on('CUSTOMIZE_SCENE_REQUESTED', () => {
            savePlayerPosition();
            // ★修正: 次のシーンに必要なデータをすべて渡す
            this.sceneManager.switchTo('customize', { gameDataManager, inputManager });
        });

        // --- Other Event Listeners ---
        this.world.on('GAME_SAVE_REQUESTED', (payload) => {
            if (payload && payload.position) {
                gameDataManager.updatePlayerPosition(payload.position.x, payload.position.y);
                gameDataManager.saveGame();
            }
        });

        // --- Initial State ---
        if (restoreMenu) {
            mapUISystem.toggleMenu();
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Map Scene...");
        super.destroy();
    }
}