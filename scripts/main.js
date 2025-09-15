/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 * ECS (Entity-Component-System) アーキテクチャのセットアップはここから始まります。
 */

import { World } from './core/world.js';
import { GameEvents } from './common/events.js';
import { initializeSystems } from './core/systemInitializer.js';
import { createPlayers } from './core/entityFactory.js';

// DOMの解析と準備が完了してからゲームの初期化を開始します。
// これにより、DOM要素に依存するシステム(ViewSystemなど)が、対象要素を見つけられないというエラーを防ぎます。
document.addEventListener('DOMContentLoaded', () => {
    // `world`はECSアーキテクチャの中心です。
    // すべてのエンティティ、コンポーネント、システムを保持・管理するコンテナの役割を果たします。
    let world = new World();


    // === ゲーム管理 ===

    /**
     * ゲームの状態を完全にリセットし、初期状態に戻します。
     * ページをリロードするのではなく、オブジェクトを再生成する理由は、
     * メモリリークを防ぎ、クリーンな状態でゲームを再開するためです。
     */
    function resetGame() {
        // 他のシステムにリセットが始まることを通知し、必要なクリーンアップ処理を促します。
        if (world.listeners.size > 0) {
            world.emit(GameEvents.GAME_WILL_RESET);
        }

        // 古いシステムのイベントリスナーなどを破棄します。
        for (const system of world.systems) {
            if (system.destroy) {
                system.destroy();
            }
        }

        // ワールドを再作成することで、すべてのエンティティとコンポーネントを破棄します。
        world = new World();

        // クリーンなワールドに、再度システムとエンティティをセットアップします。
        initializeSystems(world);
        setupGameEvents();
        createPlayers(world);

        // UIの初期構築を要求します。
        world.emit(GameEvents.SETUP_UI_REQUESTED);
    }

    /**
     * ゲーム全体に関わるイベントと、それに対応する処理を紐付けます。
     */
    function setupGameEvents() {
        world.on(GameEvents.RESET_BUTTON_CLICKED, resetGame);
    }

    // === ゲームループ ===

    let animationFrameId = null;
    let lastTime = 0;

    /**
     * ゲームのメインループ。毎フレーム呼び出され、ゲームの状態を更新・描画します。
     * `requestAnimationFrame` を使う理由は、ブラウザの描画タイミングに処理を同期させることで、
     * CPUに優しく、スムーズで効率的なアニメーションを実現するためです。
     * @param {number} timestamp - requestAnimationFrameから渡される高精度なタイムスタンプ
     */
    function gameLoop(timestamp) {
        if (!lastTime) {
            lastTime = timestamp;
        }
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // 登録されたすべてのシステムのupdateメソッドを呼び出し、ゲームの状態を更新します。
        world.update(deltaTime);

        // 次のフレームで再度gameLoopを呼び出すようにブラウザに要求します。
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // === 初期化とゲーム開始 ===
    resetGame(); // 初回起動時にゲームをセットアップ
    requestAnimationFrame(gameLoop); // ゲームループを開始
});
