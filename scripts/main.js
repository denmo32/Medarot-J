import { CONFIG } from './config.js';
import { World } from './ecs.js';
import * as Components from './components.js';
import { GameEvents } from './events.js';
import { UiSystem } from './systems/uiSystem.js';
import { RenderSystem } from './systems/renderSystem.js';
import { GaugeSystem } from './systems/gaugeSystem.js';
import { StateSystem } from './systems/stateSystem.js';
import { DecisionSystem } from './systems/decisionSystem.js';
import { ActionSystem } from './systems/actionSystem.js';
import { GameFlowSystem } from './systems/gameFlowSystem.js'; // 新しくインポート
import { GamePhaseType, PlayerStateType, TeamID, MedalPersonality } from './constants.js';

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
        // ★変更: InputSystemとAiSystemをDecisionSystemに統合
        const playerDecisionSystem = new DecisionSystem(world, TeamID.TEAM1, 'player');
        const aiDecisionSystem = new DecisionSystem(world, TeamID.TEAM2, 'ai');
        const actionSystem = new ActionSystem(world);

        world.registerSystem(gameFlowSystem); // ゲームフロー管理
        world.registerSystem(gaugeSystem);    // ゲージ更新
        world.registerSystem(stateSystem);    // 状態遷移
        // ★変更: 統合されたDecisionSystemを登録
        world.registerSystem(playerDecisionSystem); // チーム1（プレイヤー）の行動決定
        world.registerSystem(aiDecisionSystem);     // チーム2（AI）の行動決定
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

                // メダルの性格を、定義されている全ての性格の中からランダムで決定します。
                const personalityTypes = Object.values(MedalPersonality);
                const personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];

                // 各プレイヤーに必要なコンポーネントを追加
                world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
                world.addComponent(entityId, new Components.Gauge(speed));
                world.addComponent(entityId, new Components.GameState());
                world.addComponent(entityId, new Components.Parts());
                world.addComponent(entityId, new Components.DOMReference());
                world.addComponent(entityId, new Components.Action());
                // world.addComponent(entityId, new Components.Attack()); // ★廃止: Actionコンポーネントに統合
                world.addComponent(entityId, new Components.Medal(personality)); // ★追加: メダルコンポーネント
                world.addComponent(entityId, new Components.BattleLog()); // ★追加: 戦闘ログコンポーネント
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
        
        // ★修正: 処理順を変更
        // システムを再初期化し、uiSystemを生成する
        initializeSystems();

        // UIをリセットする。initializeSystemsの後なのでuiSystemは必ず存在する
        uiSystem.resetUI();

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