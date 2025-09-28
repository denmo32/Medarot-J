// inputHandler.js
import { KEY_MAP } from './constants.js';

export class InputHandler {
    constructor() {
        this.pressedKeys = new Set();
        // this.direction = null; // ← この行を削除します

        window.addEventListener('keydown', (e) => {
            if (KEY_MAP[e.key]) {
                e.preventDefault();
                this.pressedKeys.add(e.key);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (KEY_MAP[e.key]) {
                e.preventDefault();
                this.pressedKeys.delete(e.key);
            }
        });
    }

    // 現在押されているキーに基づいて移動方向を返す
    get direction() {
        // 方向キーのみを抽出して優先順位を適用
        const directionKeys = [...this.pressedKeys].filter(key => ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key));
        const lastDirectionKey = directionKeys.pop();
        return KEY_MAP[lastDirectionKey] || null;
    }
}
