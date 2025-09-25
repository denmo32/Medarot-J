// main.js
import { Game } from './game.js';

// ★ DOMContentLoadedのコールバックを async に変更
window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        const game = new Game(canvas);
        await game.init(); // ★ ゲームの初期化処理を待つ
        game.start();
    } else {
        console.error('Canvas element not found!');
    }
});