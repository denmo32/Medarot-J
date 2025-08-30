// scripts/main.js:

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
import { GamePhaseType, PlayerStateType, TeamID } from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
    const world = new World();

    // システムの登録
    const uiSystem = new UiSystem(world);
    const renderSystem = new RenderSystem(world);
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const inputSystem = new InputSystem(world);
    const aiSystem = new AiSystem(world);
    const actionSystem = new ActionSystem(world);

    world.registerSystem(gaugeSystem);
    world.registerSystem(stateSystem);
    world.registerSystem(inputSystem);
    world.registerSystem(aiSystem);
    world.registerSystem(actionSystem);
    world.registerSystem(uiSystem);
    world.registerSystem(renderSystem); // 描画は最後

    let animationFrameId = null;
    let lastTime = 0;

    function createPlayers() {
        let idCounter = 0;
        for (const [teamId, teamConfig] of Object.entries(CONFIG.TEAMS)) {
            for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
                const entityId = world.createEntity();
                const name = `メダロット ${++idCounter}`;
                const isLeader = i === 0;
                const speed = teamConfig.baseSpeed + (Math.random() * 0.2);

                world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
                world.addComponent(entityId, new Components.Gauge(speed));
                world.addComponent(entityId, new Components.GameState());
                world.addComponent(entityId, new Components.Parts());
                world.addComponent(entityId, new Components.DOMReference());
                world.addComponent(entityId, new Components.Action());
                world.addComponent(entityId, new Components.Attack());
                world.addComponent(entityId, new Components.Position(teamId === TeamID.TEAM1 ? 0 : 1, 25 + i * 25));
            }
        }
    }

    function setupUI() {
        const playerEntities = world.getEntitiesWith(Components.PlayerInfo);
        for (const entityId of playerEntities) {
            uiSystem.createPlayerDOM(entityId);
            renderSystem.updatePosition(entityId);
            renderSystem.updateInfoPanel(entityId);
        }
    }
    
    /**
     * ゲームの状態を完全にリセットする関数
     */
    function resetGame() {
        // 不具合①修正：より安定した方法で全エンティティを削除する
        const allEntities = [...world.entities.keys()];
        allEntities.forEach(id => world.destroyEntity(id));

        // world.gamePhase をリセット
        world.gamePhase.phase = GamePhaseType.IDLE;
        world.gamePhase.activePlayer = null;
        world.gamePhase.isModalActive = false;

        // UIをリセットし、新しいプレイヤーを生成・配置
        uiSystem.resetUI();
        createPlayers();
        setupUI();
    }

    /**
     * イベントリスナーをセットアップする
     * DOMイベントをWorld内のイベントに変換する責務を持つ
     */
    function setupEventListeners() {
        uiSystem.dom.startButton.addEventListener('click', () => {
            world.emit(GameEvents.START_BUTTON_CLICKED);
        });

        uiSystem.dom.resetButton.addEventListener('click', resetGame);

        uiSystem.dom.battleStartConfirmButton.addEventListener('click', () => {
            world.emit(GameEvents.BATTLE_START_CONFIRMED);
        });

        // 不具合②修正：攻撃実行モーダルの「OK」ボタンの処理
        uiSystem.dom.modalConfirmButton.addEventListener('click', () => {
            if (world.gamePhase.phase === GamePhaseType.GAME_OVER) {
                resetGame();
                return;
            }
            // 行動中のプレイヤーがいる場合、その行動が承認されたことを通知する
            // 不具合修正：activePlayerが0の場合もtrueになるように修正
            if (world.gamePhase.activePlayer !== null && world.gamePhase.activePlayer !== undefined) {
                world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: world.gamePhase.activePlayer });
            }
        });

        world.on(GameEvents.START_BUTTON_CLICKED, () => {
            if (world.gamePhase.phase !== GamePhaseType.IDLE) return;

            world.gamePhase.phase = GamePhaseType.INITIAL_SELECTION;
            const players = world.getEntitiesWith(Components.GameState);

            players.forEach(id => {
                const gameState = world.getComponent(id, Components.GameState);
                const gauge = world.getComponent(id, Components.Gauge);
                gameState.state = PlayerStateType.READY_SELECT;
                gauge.value = gauge.max;
            });

            uiSystem.dom.startButton.disabled = true;
            uiSystem.dom.startButton.textContent = "シミュレーション中...";
            uiSystem.dom.resetButton.style.display = "inline-block";
        });
        
        world.on(GameEvents.BATTLE_START_CONFIRMED, () => {
            world.gamePhase.phase = GamePhaseType.BATTLE;
            world.getEntitiesWith(Components.Gauge).forEach(id => {
                const gauge = world.getComponent(id, Components.Gauge);
                if(gauge) gauge.value = 0;
            });
            world.emit(GameEvents.HIDE_MODAL);
        });
    }

    // --- 初期化とゲームループ開始 ---
    function gameLoop(timestamp) {
        if (!lastTime) {
            lastTime = timestamp;
        }
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        if (world.gamePhase.phase !== GamePhaseType.IDLE) {
            world.update(deltaTime);
        }

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // 初回起動
    resetGame();
    setupEventListeners();
    requestAnimationFrame(gameLoop);
});