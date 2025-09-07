/**
 * @file アプリケーションのエントリーポイント
 * このファイルは、ゲーム全体の初期化とメインループの管理を行います。
 * ECS (Entity-Component-System) アーキテクチャのセットアップはここから始まります。
 */

import { CONFIG } from './common/config.js';
import { World } from './core/world.js';
import * as Components from './core/components.js';
import { GameEvents } from './common/events.js';
import { ViewSystem } from './ui/viewSystem.js';
import { DomFactorySystem } from './ui/domFactorySystem.js';
import { RenderSystem } from './ui/renderSystem.js';
import { GaugeSystem } from './systems/gaugeSystem.js';
import { StateSystem } from './systems/stateSystem.js';
import { InputSystem } from './ui/inputSystem.js';
import { AiSystem } from './systems/aiSystem.js';
import { ActionSystem } from './systems/actionSystem.js';
import { GameFlowSystem } from './systems/gameFlowSystem.js';
import { MovementSystem } from './systems/movementSystem.js';
import { HistorySystem } from './systems/historySystem.js';
import { TurnSystem } from './systems/turnSystem.js';
import { TeamID, MedalPersonality } from './common/constants.js';

// DOMの解析と準備が完了してからゲームの初期化を開始します。
// これにより、DOM要素に依存するシステム(ViewSystemなど)が、対象要素を見つけられないというエラーを防ぎます。
document.addEventListener('DOMContentLoaded', () => {
    // `world`はECSアーキテクチャの中心です。
    // すべてのエンティティ、コンポーネント、システムを保持・管理するコンテナの役割を果たします。
    let world = new World();

    // === エンティティ生成 ===
    // エンティティはゲーム内の「モノ」を表す単なるIDです。
    // ここでは、プレイヤー（メダロット）となるエンティティを生成しています。

    /**
     * 単一のプレイヤーエンティティを生成し、その特性を定義するコンポーネント群を追加します。
     * このファクトリ関数を使う理由は、プレイヤーに必要なコンポーネントのセットアップを一つの場所に集約し、
     * 再利用性とメンテナンス性を高めるためです。
     * @param {World} world - ワールドオブジェクト
     * @param {string} teamId - チームID
     * @param {object} teamConfig - チーム設定
     * @param {number} index - チーム内でのインデックス
     * @param {number} totalId - 全体での通し番号
     * @returns {number} 生成されたエンティティID
     */
    function createPlayerEntity(world, teamId, teamConfig, index, totalId) {
        const entityId = world.createEntity();
        const name = `メダロット ${totalId}`;
        const isLeader = index === 0;
        const speed = teamConfig.baseSpeed + (Math.random() * 0.2);

        // メダルの性格をランダムに決定します。
        // これにより、同じチームでもAIの挙動が異なり、ゲームに多様性が生まれます。
        const personalityTypes = Object.values(MedalPersonality);
        const personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];

        // バトルフィールド上の初期位置を計算します。
        const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
        const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + index * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;

        // エンティティにコンポーネントを追加することで、その「状態」や「能力」を定義します。
        // 例えば、`Gauge`コンポーネントは速度ゲージを持ち、`Parts`はHPや攻撃力を持ちます。
        world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
        world.addComponent(entityId, new Components.Gauge(speed));
        world.addComponent(entityId, new Components.GameState());
        world.addComponent(entityId, new Components.Parts());
        world.addComponent(entityId, new Components.DOMReference());
        world.addComponent(entityId, new Components.Action());
        world.addComponent(entityId, new Components.Medal(personality));
        world.addComponent(entityId, new Components.BattleLog());
        world.addComponent(entityId, new Components.Position(initialX, yPos));

        return entityId;
    }

    /**
     * 設定に基づいて、全プレイヤーエンティティを生成します。
     */
    function createPlayers() {
        let idCounter = 0;
        for (const [teamId, teamConfig] of Object.entries(CONFIG.TEAMS)) {
            for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
                createPlayerEntity(world, teamId, teamConfig, i, ++idCounter);
            }
        }
    }

    // === システム初期化 ===
    // システムは、コンポーネントのデータに作用して「ロジック」を実行します。

    /**
     * ゲームに必要なすべてのシステムを初期化し、ワールドに登録します。
     */
    function initializeSystems() {
        // --- シングルトンコンポーネントの作成 ---
        // GameContextは、特定のエンティティに属さない、ゲーム全体のグローバルな状態を保持します。
        // これをシングルトンとして扱うことで、どのシステムからでも安全にゲーム全体の状態にアクセスできます。
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new Components.GameContext());

        // --- システムの登録 ---
        // システムは、イベント駆動で動くものと、毎フレームupdateで動くものに大別されます。

        // イベント駆動システムは、特定のイベントが発生したときだけ動作します。
        // これらはupdateループに登録する必要がなく、パフォーマンス上の利点があります。
        new InputSystem(world); // プレイヤーの入力イベントを待つ
        new AiSystem(world);    // AIの思考要求イベントを待つ
        new DomFactorySystem(world); // UIの構築要求イベントを待つ

        // updateループで動作するシステムは、毎フレーム状態を更新します。
        // 登録順序は、データの流れを意識して決定されています。
        // 例えば、StateSystemが状態を変更し、それを受けてMovementSystemが位置を計算し、
        // 最後にRenderSystemがその結果を描画する、という依存関係に基づいています。
        const gameFlowSystem = new GameFlowSystem(world);
        const viewSystem = new ViewSystem(world);
        const renderSystem = new RenderSystem(world);
        const gaugeSystem = new GaugeSystem(world);
        const stateSystem = new StateSystem(world);
        const turnSystem = new TurnSystem(world);
        const actionSystem = new ActionSystem(world);
        const movementSystem = new MovementSystem(world);
        const historySystem = new HistorySystem(world);

        world.registerSystem(gameFlowSystem); // ゲーム全体の進行管理
        world.registerSystem(historySystem);  // 戦闘履歴の更新
        world.registerSystem(stateSystem);    // 各エンティティの状態遷移
        world.registerSystem(turnSystem);     // 行動順の決定
        world.registerSystem(gaugeSystem);    // ゲージの増減
        world.registerSystem(actionSystem);   // 行動の実行
        world.registerSystem(movementSystem); // 位置情報の計算
        world.registerSystem(viewSystem);     // UIの状態管理
        world.registerSystem(renderSystem);   // 計算結果の画面描画
    }

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
        initializeSystems();
        setupGameEvents();
        createPlayers();

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
    setupGameEvents(); // リセットボタンのイベントリスナーを登録
    requestAnimationFrame(gameLoop); // ゲームループを開始
});