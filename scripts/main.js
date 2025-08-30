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
import { GamePhaseType, PlayerStateType } from './constants.js';

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

    // グローバル状態のエンティティを作成
    const gameEntity = world.createEntity();
    
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
                world.addComponent(entityId, new Components.Position(teamId === 'team1' ? 0 : 1, 25 + i * 25));
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
    
    function resetGame() {
        // gameEntity以外の全エンティティIDを収集
        const entitiesToDelete = Array.from(world.entities.keys()).filter(id => id !== gameEntity);

        // 収集したIDに基づいてエンティティを削除
        for (const entityId of entitiesToDelete) {
            world.destroyEntity(entityId);
        }

        // 新しいGamePhaseコンポーネントを追加してリセット
        world.addComponent(gameEntity, new Components.GamePhase());

        uiSystem.resetUI();
        createPlayers();
        setupUI();
    }

    /**
     * 新規追加：イベントリスナーをまとめる関数
     * main.jsの初期化処理を整理し、見通しを良くする
     */
    function setupEventListeners() {
        uiSystem.dom.startButton.addEventListener('click', () => {
            const gamePhase = world.getComponent(gameEntity, Components.GamePhase);
            if (gamePhase.phase !== GamePhaseType.IDLE) return;

            gamePhase.phase = GamePhaseType.INITIAL_SELECTION;
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

        uiSystem.dom.resetButton.addEventListener('click', resetGame);

        uiSystem.dom.battleStartConfirmButton.addEventListener('click', () => {
            const gamePhase = world.getComponent(gameEntity, Components.GamePhase);
            gamePhase.phase = GamePhaseType.BATTLE;
            world.getEntitiesWith(Components.Gauge).forEach(id => {
                const gauge = world.getComponent(id, Components.Gauge);
                if(gauge) gauge.value = 0;
            });
            uiSystem.hideModal();
        });

        document.addEventListener(GameEvents.ACTION_SELECTED, ({ detail }) => {
            const { entityId, partKey } = detail;
            const action = world.getComponent(entityId, Components.Action);
            const parts = world.getComponent(entityId, Components.Parts);
            const gameState = world.getComponent(entityId, Components.GameState);
            const gauge = world.getComponent(entityId, Components.Gauge);
            const gamePhase = world.getComponent(gameEntity, Components.GamePhase);

            action.partKey = partKey;
            action.type = parts[partKey].action;
            gameState.state = PlayerStateType.SELECTED_CHARGING;
            gauge.value = 0;
            gamePhase.activePlayer = null;
            uiSystem.hideModal();
        });

        uiSystem.dom.modalConfirmButton.addEventListener('click', () => {
            const gamePhase = world.getComponent(gameEntity, Components.GamePhase);
            if (gamePhase.phase === GamePhaseType.GAME_OVER) {
                resetGame();
                return;
            }
            if (gamePhase.activePlayer) {
                // 提案1: ActionSystemを直接呼び出すのではなく、イベントを発行して疎結合にする
                document.dispatchEvent(new CustomEvent(GameEvents.EXECUTION_CONFIRMED, {
                    detail: { entityId: gamePhase.activePlayer }
                }));
                // actionSystem.applyDamage(gamePhase.activePlayer); // ← この直接呼び出しをやめる
            }
            uiSystem.hideModal();
        });
    }

    // --- 初期化とゲームループ開始 ---
    function gameLoop(timestamp) {
        const gamePhase = world.getComponent(gameEntity, Components.GamePhase);

        if (!lastTime) {
            lastTime = timestamp;
        }
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        // ゲームがアクティブなときだけ更新
        if (gamePhase && gamePhase.phase !== GamePhaseType.IDLE) {
            world.update(deltaTime);
        }

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // 初回起動
    resetGame();
    setupEventListeners(); // イベントリスナーをセットアップ
    requestAnimationFrame(gameLoop);
});