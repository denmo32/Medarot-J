// game.js
import { CONFIG, PLAYER_STATES } from './constants.js';
import { InputHandler } from './inputHandler.js';
import { Map } from './map.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import * as MapComponents from './components.js';
import { PlayerInputSystem } from './systems/PlayerInputSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';

export class Game {
    constructor(canvas, world) {
        this.canvas = canvas;
        this.world = world;
        this.canvas.width = CONFIG.VIEWPORT_WIDTH;
        this.canvas.height = CONFIG.VIEWPORT_HEIGHT;
        
        this.lastTime = 0;
        
        this.input = new InputHandler();
        this.renderer = new Renderer(canvas);
        this.camera = new Camera();

        this.playerInputSystem = null;
        this.movementSystem = null;

        this.map = null;
        this.playerEntityId = null;
    }
    
    /**
     * Asynchronous game initialization
     */
    async init() {
        // Load map data
        const response = await fetch('scripts/map/map.json');
        const mapData = await response.json();
        this.map = new Map(mapData);

        // Initialize and register systems
        this.playerInputSystem = new PlayerInputSystem(this.world, this.input, this.map);
        this.movementSystem = new MovementSystem(this.world, this.map);
        this.world.registerSystem(this.playerInputSystem);
        this.world.registerSystem(this.movementSystem);

        // Create the player entity
        this.playerEntityId = this.world.createEntity();
        
        const initialX = 1 * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
        const initialY = 1 * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;

        this.world.addComponent(this.playerEntityId, new MapComponents.Position(initialX, initialY));
        this.world.addComponent(this.playerEntityId, new MapComponents.Velocity(0, 0));
        this.world.addComponent(this.playerEntityId, new MapComponents.Renderable('circle', 'gold', CONFIG.PLAYER_SIZE));
        this.world.addComponent(this.playerEntityId, new MapComponents.PlayerControllable());
        this.world.addComponent(this.playerEntityId, new MapComponents.Collision(CONFIG.PLAYER_SIZE, CONFIG.PLAYER_SIZE));
        this.world.addComponent(this.playerEntityId, new MapComponents.State(PLAYER_STATES.IDLE));

        console.log(`Player entity ${this.playerEntityId} created in ECS world.`);
    }

    start() {
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(deltaTime) {
        if (!deltaTime || !this.map) {
            return;
        }

        this.world.update(deltaTime); // ここでECSシステムを更新

        // Update camera
        this.camera.update(this.world, this.playerEntityId, this.map);
    }

    draw() {
        if (!this.map) return;

        // Render the world
        this.renderer.render(this.world, this.map, this.camera);
    }
}
