// game.js
import { CONFIG } from './constants.js';
import { InputHandler } from './inputHandler.js';
import { Player } from './player.js';
import { Map } from './map.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = CONFIG.VIEWPORT_WIDTH;
        this.canvas.height = CONFIG.VIEWPORT_HEIGHT;
        
        this.lastTime = 0;
        
        this.input = new InputHandler();
        this.renderer = new Renderer(canvas);
        this.camera = new Camera();

        // ★ 初期化時にnullにしておく
        this.map = null;
        this.player = null;
        this.entities = [];
    }
    
    /**
     * ★ ゲームの非同期初期化処理
     */
    async init() {
        // マップデータをロード
        const response = await fetch('scripts/map/map.json');
        const mapData = await response.json();
        this.map = new Map(mapData);

        // エンティティを作成
        this.player = new Player(1, 1);
        this.player.initialize(this.map); // ★ PlayerにMapの参照を渡して初期化
        this.entities.push(this.player);
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
        if (!deltaTime || !this.map) return; // ★ mapがロードされるまで何もしない

        for (const entity of this.entities) {
            if (typeof entity.update === 'function') {
                entity.update(deltaTime, this.input, this.map);
            }
        }
        
        this.camera.update(this.player, this.map); // ★ camera.updateにmapを渡す
    }

    draw() {
        if (!this.map) return; // ★ mapがロードされるまで何もしない
        this.renderer.render(this.entities, this.map, this.camera);
    }
}
