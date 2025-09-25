// playerStates.js
import { CONFIG, PLAYER_STATES, TILE_TYPES } from './constants.js';

// 基底状態クラス
class State {
    constructor(player) {
        this.player = player;
    }

    enter() {}
    exit() {}
    handleInput(input) {}
    update(deltaTime, map) {}
}

// 待機状態
export class IdleState extends State {
    enter() {
        this.player.state = PLAYER_STATES.IDLE;
    }

    handleInput(input) {
        const direction = input.direction;
        if (direction) {
            this.player.setState(PLAYER_STATES.WALKING);
        }
    }
}

// 歩行状態
export class WalkingState extends State {
    enter() {
        this.player.state = PLAYER_STATES.WALKING;
        // ★ 移動先の計算ロジックをPlayerからこちらに移動
        this.calculateTarget(this.player.lastDirection);
    }

    update(deltaTime, map) {
        const moveAmount = this.player.speed * (deltaTime / 1000);

        // x軸方向の移動
        if (this.player.x < this.player.targetX) {
            this.player.x = Math.min(this.player.x + moveAmount, this.player.targetX);
        } else if (this.player.x > this.player.targetX) {
            this.player.x = Math.max(this.player.x - moveAmount, this.player.targetX);
        }

        // y軸方向の移動
        if (this.player.y < this.player.targetY) {
            this.player.y = Math.min(this.player.y + moveAmount, this.player.targetY);
        } else if (this.player.y > this.player.targetY) {
            this.player.y = Math.max(this.player.y - moveAmount, this.player.targetY);
        }

        // 目的地に到着したらタイルをチェック
        if (this.player.x === this.player.targetX && this.player.y === this.player.targetY) {
            const centerX = this.player.x + (this.player.size / 2);
            const centerY = this.player.y + (this.player.size / 2);
            const tileX = Math.floor(centerX / CONFIG.TILE_SIZE);
            const tileY = Math.floor(centerY / CONFIG.TILE_SIZE);
            const currentTile = this.player.map.getTileType(tileX, tileY);

            if (currentTile === TILE_TYPES.BATTLE_TRIGGER) {
                // 戦闘開始イベントを発行
                window.dispatchEvent(new CustomEvent('startbattle'));
            }
            
            this.player.setState(PLAYER_STATES.IDLE);
        }
    }

    calculateTarget(direction) {
        let nextX = this.player.x;
        let nextY = this.player.y;
        
        if (direction === 'up') nextY -= CONFIG.TILE_SIZE;
        else if (direction === 'down') nextY += CONFIG.TILE_SIZE;
        else if (direction === 'left') nextX -= CONFIG.TILE_SIZE;
        else if (direction === 'right') nextX += CONFIG.TILE_SIZE;

        // ★ PlayerのisCollidingを直接呼ぶのではなく、Mapのメソッドを使う
        if (!this.player.map.isColliding(this.player.getBounds(nextX, nextY))) {
            this.player.targetX = nextX;
            this.player.targetY = nextY;
        } else {
            // 壁に衝突した場合は移動せず、すぐに待機状態に戻る
            this.player.targetX = this.player.x;
            this.player.targetY = this.player.y;
            this.player.setState(PLAYER_STATES.IDLE);
        }
    }
}
