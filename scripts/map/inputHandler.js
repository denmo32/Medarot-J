// inputHandler.js
import { KEY_MAP } from './constants.js';

export class InputHandler {
    constructor() {
        this.pressedKeys = new Set();
        // this.direction = null; // ← この行を削除します

        window.addEventListener('keydown', (e) => {
            // console.log('InputHandler keydown:', e.key, e); // デバッグ用
            if (KEY_MAP[e.key]) {
                // カスタマイズ画面が表示されている場合は、e.preventDefault() を呼び出さない
                const customizeElement = document.getElementById('customize-container');
                if (!customizeElement || customizeElement.classList.contains('hidden')) {
                    e.preventDefault();
                }
                this.pressedKeys.add(e.key);
            }
        });

        window.addEventListener('keyup', (e) => {
            // console.log('InputHandler keyup:', e.key, e); // デバッグ用
            if (KEY_MAP[e.key]) {
                // カスタマイズ画面が表示されている場合は、e.preventDefault() を呼び出さない
                const customizeElement = document.getElementById('customize-container');
                if (!customizeElement || customizeElement.classList.contains('hidden')) {
                    e.preventDefault();
                }
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
