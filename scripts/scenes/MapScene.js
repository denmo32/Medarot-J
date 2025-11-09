/**
 * @file MapScene.js
 * @description マップ探索モードのセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from './BaseScene.js';
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

// マップシーン専用のUI状態コンポーネントを定義
export class MapUIState {
    constructor() {
        this.isMapMenuVisible = false;
        this.isPausedByModal = false; // NPCとの対話ウィンドウなどで使用
        this.modalJustOpened = false;
    }
}

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
        // マップシーン専用のUI状態コンポーネントをシングルトンとして登録
        const contextEntity = this.world.createEntity();
        const mapUIState = new MapUIState();
        this.world.addComponent(contextEntity, mapUIState);

        // --- Systems ---
        const mapUISystem = new MapUISystem(this.world, inputManager);
        this.world.registerSystem(new PlayerInputSystem(this.world, inputManager, map));
        this.world.registerSystem(new MovementSystem(this.world, map));
        this.world.registerSystem(new CameraSystem(this.world, camera, map));
        this.world.registerSystem(new MapRenderSystem(this.world, renderer, map, camera));
        this.world.registerSystem(mapUISystem);
        // InteractionSystemを登録
        this.world.registerSystem(new InteractionSystem(this.world, map));


        // --- Entities ---
        const playerEntityId = this.world.createEntity();
        const mapPlayerData = gameDataManager.getPlayerDataForMap();
        this.world.addComponent(playerEntityId, new MapComponents.Position(mapPlayerData.position.x, mapPlayerData.position.y));
        this.world.addComponent(playerEntityId, new MapComponents.Velocity(0, 0));
        this.world.addComponent(playerEntityId, new MapComponents.Renderable('circle', 'gold', MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.PlayerControllable());
        this.world.addComponent(playerEntityId, new MapComponents.Collision(MAP_CONFIG.PLAYER_SIZE, MAP_CONFIG.PLAYER_SIZE));
        this.world.addComponent(playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));
        // 保存された向き情報でFacingDirectionコンポーネントを初期化
        this.world.addComponent(playerEntityId, new MapComponents.FacingDirection(mapPlayerData.position.direction));

        // --- Event Listeners for Scene Transition ---
        const savePlayerState = () => {
            const pos = this.world.getComponent(playerEntityId, MapComponents.Position);
            // 向き情報も取得
            const dir = this.world.getComponent(playerEntityId, MapComponents.FacingDirection);
            if (pos && dir) {
                // 位置と向きをまとめて更新
                gameDataManager.updatePlayerMapState({ x: pos.x, y: pos.y, direction: dir.direction });
            }
        };
        
        this.world.on(MAP_EVENTS.BATTLE_TRIGGERED, () => {
            savePlayerState();
            this.sceneManager.switchTo('battle', { gameDataManager, inputManager });
        });
        this.world.on('NPC_INTERACTED', () => {
            savePlayerState();
            this.sceneManager.switchTo('battle', { gameDataManager, inputManager });
        });
        this.world.on('CUSTOMIZE_SCENE_REQUESTED', () => {
            savePlayerState();
            this.sceneManager.switchTo('customize', { gameDataManager, inputManager });
        });

        // --- Other Event Listeners ---
        // セーブ要求イベントのハンドラを更新
        this.world.on('GAME_SAVE_REQUESTED', () => {
            // 現在の位置と向きでセーブデータを更新
            savePlayerState();
            // セーブを実行
            gameDataManager.saveGame();
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