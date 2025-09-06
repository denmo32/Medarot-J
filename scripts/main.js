import { CONFIG } from './config.js';
import { World } from './ecs.js';
import * as Components from './components.js';
import { GameEvents } from './events.js';
// ★変更: UiSystemをViewSystemにリネームし、DomFactorySystemをインポート
import { ViewSystem } from './systems/viewSystem.js';
import { DomFactorySystem } from './systems/domFactorySystem.js';
import { RenderSystem } from './systems/renderSystem.js';
import { GaugeSystem } from './systems/gaugeSystem.js';
import { StateSystem } from './systems/stateSystem.js';
import { InputSystem } from './systems/inputSystem.js';
import { AiSystem } from './systems/aiSystem.js';
import { ActionSystem } from './systems/actionSystem.js';
import { GameFlowSystem } from './systems/gameFlowSystem.js';
import { MovementSystem } from './systems/movementSystem.js';
import { HistorySystem } from './systems/historySystem.js';
import { TurnSystem } from './systems/turnSystem.js';
import { GamePhaseType, PlayerStateType, TeamID, MedalPersonality } from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
    let world = new World();

    // === エンティティ生成関数群 ===

    /**
     * プレイヤーエンティティを生成し、必要なコンポーネントをすべて追加するファクトリ関数
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

        // メダルの性格をランダムに決定
        const personalityTypes = Object.values(MedalPersonality);
        const personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];

        // 位置を計算
        const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
        const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + index * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;

        // コンポーネントを追加
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
     * チームのプレイヤーエンティティを生成する関数
     */
    function createPlayers() {
        let idCounter = 0;
        for (const [teamId, teamConfig] of Object.entries(CONFIG.TEAMS)) {
            for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
                createPlayerEntity(world, teamId, teamConfig, i, ++idCounter);
            }
        }
    }

    // === システム初期化関数群 ===

    /**
     * ゲームの初期化とシステムの登録を行う関数
     */
    function initializeSystems() {
        // --- シングルトンコンポーネントの作成 ---
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new Components.GameContext());

        // --- システムの登録 ---
        // イベント駆動システム (updateループ不要)
        new InputSystem(world);
        new AiSystem(world);
        new DomFactorySystem(world);

        // updateループで動作するシステム
        const gameFlowSystem = new GameFlowSystem(world);
        const viewSystem = new ViewSystem(world);
        const renderSystem = new RenderSystem(world);
        const gaugeSystem = new GaugeSystem(world);
        const stateSystem = new StateSystem(world);
        const turnSystem = new TurnSystem(world);
        const actionSystem = new ActionSystem(world);
        const movementSystem = new MovementSystem(world);
        const historySystem = new HistorySystem(world);

        world.registerSystem(gameFlowSystem);
        world.registerSystem(historySystem);
        world.registerSystem(stateSystem);
        world.registerSystem(turnSystem);
        world.registerSystem(gaugeSystem);
        world.registerSystem(actionSystem);
        world.registerSystem(movementSystem);
        world.registerSystem(viewSystem);
        world.registerSystem(renderSystem);
    }

    // === ゲーム管理関数群 ===

    /**
     * ゲームの状態を完全にリセットする関数
     */
    function resetGame() {
        // リセット開始を通知
        if (world.listeners.size > 0) {
            world.emit(GameEvents.GAME_WILL_RESET);
        }

        // 古いシステムのクリーンアップ
        for (const system of world.systems) {
            if (system.destroy) {
                system.destroy();
            }
        }

        // ワールドを再作成
        world = new World();

        // システムを再初期化
        initializeSystems();
        setupGameEvents();

        // プレイヤーエンティティを再生成
        createPlayers();

        // UI構築を要求
        world.emit(GameEvents.SETUP_UI_REQUESTED);
    }

    /**
     * ゲーム内イベントとリセット処理を紐付ける
     */
    function setupGameEvents() {
        world.on(GameEvents.RESET_BUTTON_CLICKED, resetGame);
    }

    // === ゲームループ関数群 ===

    let animationFrameId = null;
    let lastTime = 0;

    function gameLoop(timestamp) {
        if (!lastTime) {
            lastTime = timestamp;
        }
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // ワールドの状態を更新
        world.update(deltaTime);

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // === 初期化とゲーム開始 ===
    resetGame(); // 初回起動時にゲームをセットアップ
    setupGameEvents(); // リセットイベントを購読
    requestAnimationFrame(gameLoop); // ゲームループを開始
});
