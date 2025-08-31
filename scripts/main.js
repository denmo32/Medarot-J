import { CONFIG } from './config.js';
import { World } from './ecs.js';
import * as Components from './components.js';
import { GameEvents } from './events.js';
import { UiSystem } from './systems/uiSystem.js';
import { RenderSystem } from './systems/renderSystem.js';
import { GaugeSystem } from './systems/gaugeSystem.js';
import { StateSystem } from './systems/stateSystem.js';
// ★変更: DecisionSystemを削除し、新しいシステムをインポート
import { InputSystem } from './systems/inputSystem.js';
import { AiSystem } from './systems/aiSystem.js';
import { ActionSystem } from './systems/actionSystem.js';
import { GameFlowSystem } from './systems/gameFlowSystem.js'; // 新しくインポート
import { MovementSystem } from './systems/movementSystem.js';
import { HistorySystem } from './systems/historySystem.js';
// ★追加: 新しいTurnSystemをインポート
import { TurnSystem } from './systems/turnSystem.js';
import { GamePhaseType, PlayerStateType, TeamID, MedalPersonality } from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
    let world = new World();
    let uiSystem; // resetGameで参照するため、外で宣言

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
     * ゲームの初期化とシステムの登録を行う関数
     */
    function initializeSystems() {
        // --- シングルトンコンポーネントの作成 ---
        const contextEntity = world.createEntity();
        world.addComponent(contextEntity, new Components.GameContext());

        // --- システムの登録 ---
        // ★変更: システムの登録順と構成を新しいアーキテクチャに合わせて見直し
        
        // --- イベント駆動システム (updateループ不要) ---
        // これらのシステムはインスタンス化されると、コンストラクタでイベントリスナーを登録します。
        new InputSystem(world);
        new AiSystem(world);

        // --- updateループで動作するシステム ---
        const gameFlowSystem = new GameFlowSystem(world);
        uiSystem = new UiSystem(world);
        const renderSystem = new RenderSystem(world);
        const gaugeSystem = new GaugeSystem(world);
        const stateSystem = new StateSystem(world);
        const turnSystem = new TurnSystem(world); // ★新規: TurnSystemを登録
        const actionSystem = new ActionSystem(world);
        const movementSystem = new MovementSystem(world);
        const historySystem = new HistorySystem(world);

        world.registerSystem(gameFlowSystem);
        world.registerSystem(historySystem);
        world.registerSystem(stateSystem);
        world.registerSystem(turnSystem); // ★新規: TurnSystemはupdateを持つ
        world.registerSystem(gaugeSystem);
        world.registerSystem(actionSystem);
        world.registerSystem(movementSystem);
        world.registerSystem(uiSystem);
        world.registerSystem(renderSystem);
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