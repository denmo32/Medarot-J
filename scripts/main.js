import { CONFIG } from './config.js';
import { World } from './ecs.js';
import * as Components from './components.js';
import { GameEvents } from './events.js';
import { UiSystem } from './systems/uiSystem.js';
import { RenderSystem } from './systems/renderSystem.js';
import { GaugeSystem } from './systems/gaugeSystem.js';
import { StateSystem } from './systems/stateSystem.js';
import { AiSystem } from './systems/aiSystem.js';
import { InputSystem } from './systems/inputSystem.js';
import { ActionSystem } from './systems/actionSystem.js';
import { GameFlowSystem } from './systems/gameFlowSystem.js'; // 新しくインポート
import { GamePhaseType, PlayerStateType, TeamID } from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
    let world = new World();
    let uiSystem; // resetGameで参照するため、外で宣言

    /**
     * ゲームの初期化とシステムの登録を行う関数
     */
    function initializeSystems() {
        // --- シングルトンコンポーネントの作成 ---
        // ゲーム全体のグローバルな状態を管理するエンティティを作成
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new Components.GameContext());

        // --- システムの登録 ---
        // GameFlowSystemは他のシステムより先に登録し、GameContextへの参照を渡す
        const gameFlowSystem = new GameFlowSystem(world);
        uiSystem = new UiSystem(world);
        const renderSystem = new RenderSystem(world);
        const gaugeSystem = new GaugeSystem(world);
        const stateSystem = new StateSystem(world);
        const inputSystem = new InputSystem(world);
        const aiSystem = new AiSystem(world);
        const actionSystem = new ActionSystem(world);

        world.registerSystem(gameFlowSystem); // ゲームフロー管理
        world.registerSystem(gaugeSystem);    // ゲージ更新
        world.registerSystem(stateSystem);    // 状態遷移
        world.registerSystem(inputSystem);    // プレイヤー入力
        world.registerSystem(aiSystem);       // AI思考
        world.registerSystem(actionSystem);   // 行動実行
        world.registerSystem(uiSystem);       // UI更新（ボタン状態など）
        world.registerSystem(renderSystem);   // 描画（最後）
    }

    /**
     * チームのプレイヤーエンティティを生成する関数
     */
    function createPlayers() {
        let idCounter = 0;
        // CONFIGからチーム設定を読み込み、プレイヤーを生成
        for (const [teamId, teamConfig] of Object.entries(CONFIG.TEAMS)) {
            for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
                const entityId = world.createEntity();
                const name = `メダロット ${++idCounter}`;
                const isLeader = i === 0;
                const speed = teamConfig.baseSpeed + (Math.random() * 0.2);

                // 各プレイヤーに必要なコンポーネントを追加
                world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
                world.addComponent(entityId, new Components.Gauge(speed));
                world.addComponent(entityId, new Components.GameState());
                world.addComponent(entityId, new Components.Parts());
                world.addComponent(entityId, new Components.DOMReference());
                world.addComponent(entityId, new Components.Action());
                world.addComponent(entityId, new Components.Attack());
                // Positionコンポーネントで初期位置を設定
                world.addComponent(entityId, new Components.Position(teamId === TeamID.TEAM1 ? 0 : 1, 25 + i * 25));
            }
        }
    }

    /**
     * 生成されたプレイヤーのDOM要素を作成・配置する関数
     */
    function setupUI() {
        const playerEntities = world.getEntitiesWith(Components.PlayerInfo);
        for (const entityId of playerEntities) {
            uiSystem.createPlayerDOM(entityId);
            // RenderSystemのメソッドを直接呼ぶのではなく、最初の描画更新に任せる
            // renderSystem.updatePosition(entityId);
            // renderSystem.updateInfoPanel(entityId);
        }
    }
    
    /**
     * ゲームの状態を完全にリセットする関数
     */
    function resetGame() {
        // 既存のワールドを破棄して、新しいインスタンスを作成
        world = new World();
        
        // UIをリセット（DOM要素をクリア）
        if (uiSystem) {
            uiSystem.resetUI();
        }

        // システムを再初期化
        initializeSystems();
        // プレイヤーを再生成
        createPlayers();
        // UIを再セットアップ
        setupUI();
    }

    /**
     * ゲーム内イベントとリセット処理を紐付ける
     */
    function setupGameEvents() {
        world.on(GameEvents.RESET_BUTTON_CLICKED, resetGame);
    }

    // --- ゲームループ ---
    let animationFrameId = null;
    let lastTime = 0;

    function gameLoop(timestamp) {
        if (!lastTime) {
            lastTime = timestamp;
        }
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // ワールドの状態を更新（全システムのupdateが呼ばれる）
        world.update(deltaTime);

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- 初期化とゲーム開始 ---
    resetGame(); // 初回起動時にゲームをセットアップ
    setupGameEvents(); // リセットイベントを購読
    requestAnimationFrame(gameLoop); // ゲームループを開始
});