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
        // 優先順位: 最後に追加されたキーを優先する
        const lastKey = [...this.pressedKeys].pop();
        return KEY_MAP[lastKey] || null;
    }
}
