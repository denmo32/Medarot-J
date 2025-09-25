// player.js
import { CONFIG, PLAYER_STATES } from './constants.js';
import { IdleState, WalkingState } from './playerStates.js'; // ★ 状態クラスをインポート

export class Player {
    constructor(x, y) {
        this.x = x * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
        this.y = y * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
        this.size = CONFIG.PLAYER_SIZE;
        this.speed = CONFIG.PLAYER_SPEED_PPS;
        this.color = 'gold';

        this.targetX = this.x;
        this.targetY = this.y;
        this.map = null; // ★ Mapへの参照を保持
        this.lastDirection = null; // ★ 最後に押された方向キーを保持

        // ▼▼▼ Stateパターン関連のプロパティ ▼▼▼
        this.states = {
            [PLAYER_STATES.IDLE]: new IdleState(this),
            [PLAYER_STATES.WALKING]: new WalkingState(this),
        };
        this.currentState = null;
        // ▲▲▲ ▲▲▲ ▲▲▲
    }

    // ★ ゲーム開始時にMapの参照を受け取り、初期状態を設定するメソッド
    initialize(map) {
        this.map = map;
        this.setState(PLAYER_STATES.IDLE);
    }
    
    // ★ 状態を変更するメソッド
    setState(newStateKey) {
        const oldState = this.currentState;
        if (oldState) {
            oldState.exit();
        }
        this.currentState = this.states[newStateKey];
        this.currentState.enter();
    }

    update(deltaTime, input, map) {
        // ★ 現在の状態に処理を委譲する
        if (this.currentState) {
            // 最後に押された方向キーを更新
            if(input.direction) {
                this.lastDirection = input.direction;
            }

            this.currentState.handleInput(input);
            this.currentState.update(deltaTime, map);
        }
    }

    draw(renderer) {
        renderer.drawCircle(
            this.x + this.size / 2, 
            this.y + this.size / 2, 
            this.size / 2, 
            this.color
        );
    }

    getBounds(x = this.x, y = this.y) {
        // 当たり判定を少し小さくすると操作感が向上する
        const padding = 2; 
        return {
            x: x + padding,
            y: y + padding,
            width: this.size - padding * 2,
            height: this.size - padding * 2,
        };
    }
}
