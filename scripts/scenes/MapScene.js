/**
 * @file MapScene.js
 * @description マップ探索モードのセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from '../engine/BaseScene.js';
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
import { InteractionSystem } from '../map/systems/InteractionSystem.js';
import { GameEvents } from '../battle/common/events.js';

// マップシーン専用のUI状態コンポーネントを定義
export class MapUIState {
    constructor() {
        this.isMapMenuVisible = false;
        this.isPausedByModal = false; // NPCとの対話ウィンドウなどで使用
        this.modalJustOpened = false;
    }
}

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
        const { gameDataManager, restoreMenu = false } = data;

        // --- Resources & Canvas ---
        const { canvas, map } = await this._setupResources();

        // --- Contexts ---
        this._setupContexts();

        // --- Systems ---
        const mapUISystem = this._setupSystems(canvas, map);

        // --- Entities ---
        const playerEntityId = this._setupEntities(gameDataManager);

        // --- Events ---
        this._bindEvents(gameDataManager, playerEntityId);

        // --- Initial State ---
        if (restoreMenu) {
            mapUISystem.toggleMenu();
        }
    }

    /**
     * リソースのロードとキャンバスのセットアップを行います。
     * @returns {Promise<{canvas: HTMLElement, map: Map}>}
     * @private
     */
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

    /**
     * シーン固有のコンテキスト（UI状態など）をセットアップします。
     * @private
     */
    _setupContexts() {
        const contextEntity = this.world.createEntity();
        const mapUIState = new MapUIState();
        this.world.addComponent(contextEntity, mapUIState);
    }

    /**
     * システム群を初期化・登録します。
     * InputManagerは各システムがWorldから直接取得するため、ここでは渡しません。
     * @param {HTMLElement} canvas 
     * @param {Map} map 
     * @returns {MapUISystem} 初期化したUIシステムを返す（初期状態設定のため）
     * @private
     */
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

    /**
     * プレイヤーエンティティを初期化します。
     * @param {GameDataManager} gameDataManager 
     * @returns {number} プレイヤーエンティティID
     * @private
     */
    _setupEntities(gameDataManager) {
        const playerEntityId = this.world.createEntity();
        const mapPlayerData = gameDataManager.getPlayerDataForMap();
        
        this.world.addComponent(playerEntityId, new MapComponents.Position(mapPlayerData.position.x, mapPlayerData.position.y));
        this.world.addComponent(playerEntityId, new MapComponents.Velocity(0, 0));
        this.world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
        this.world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
        this.world.addComponent(playerEntityId, new MapComponents.FacingDirection(mapPlayerData.position.direction));

        return playerEntityId;
    }

    /**
     * イベントリスナーを設定します。
     * @param {GameDataManager} gameDataManager 
     * @param {number} playerEntityId 
     * @private
     */
    _bindEvents(gameDataManager, playerEntityId) {
        // プレイヤーの状態保存用ヘルパー
        const savePlayerState = () => {
            const pos = this.world.getComponent(playerEntityId, MapComponents.Position);
            const dir = this.world.getComponent(playerEntityId, MapComponents.FacingDirection);
            if (pos && dir) {
                gameDataManager.updatePlayerMapState({ x: pos.x, y: pos.y, direction: dir.direction });
            }
        };
        
        // シーン遷移イベント
        const switchTo = (sceneName, additionalData = {}) => {
            savePlayerState();
            // InputManagerはECS経由で取得されるため、dataとして渡す必要はない
            this.sceneManager.switchTo(sceneName, { gameDataManager, ...additionalData });
        };

        this.world.on(MAP_EVENTS.BATTLE_TRIGGERED, () => switchTo('battle'));
        this.world.on(GameEvents.NPC_INTERACTED, () => switchTo('battle'));
        this.world.on(GameEvents.CUSTOMIZE_SCENE_REQUESTED, () => switchTo('customize'));

        // セーブ要求
        this.world.on(GameEvents.GAME_SAVE_REQUESTED, () => {
            savePlayerState();
            gameDataManager.saveGame();
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