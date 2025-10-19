import * as Components from './components/index.js';
import { GameModeContext } from './GameModeContext.js';
import { BattlePhaseContext } from './BattlePhaseContext.js';
import { UIStateContext } from './UIStateContext.js';
import { BattleHistoryContext } from './BattleHistoryContext.js';
import { ViewSystem } from '../ui/viewSystem.js';
import { DomFactorySystem } from '../ui/domFactorySystem.js';
import { ActionPanelSystem } from '../ui/actionPanelSystem.js';
import { GaugeSystem } from '../systems/gaugeSystem.js';
import { StateSystem } from '../systems/stateSystem.js';
import { InputSystem } from '../ui/inputSystem.js';
import { AiSystem } from '../systems/aiSystem.js';
import { ActionSystem } from '../systems/actionSystem.js';
import { GameFlowSystem } from '../systems/gameFlowSystem.js';
import { MovementSystem } from '../systems/movementSystem.js';
import { HistorySystem } from '../systems/historySystem.js';
import { TurnSystem } from '../systems/turnSystem.js';
import { EffectSystem } from '../systems/effectSystem.js';
import { EffectApplicatorSystem } from '../systems/effectApplicatorSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { UISystem } from '../ui/UISystem.js';
import { MessageSystem } from '../systems/MessageSystem.js';
import { CombatResolutionSystem } from '../systems/combatResolutionSystem.js';
import { ActionCancellationSystem } from '../systems/actionCancellationSystem.js';
import { DebugSystem } from '../systems/DebugSystem.js';
import { CONFIG } from '../common/config.js';

/**
 * ゲームに必要なすべてのシステムを初期化し、ワールドに登録します。
 * @param {World} world - ワールドオブジェクト
 */
export function initializeSystems(world) {
    // --- シングルトンコンポーネントの作成 ---
    // Old GameContext responsibilities are now split into separate singleton components
    const contextEntity = world.createEntity();
    world.addComponent(contextEntity, new GameModeContext()); // Manages game mode (map, battle)
    world.addComponent(contextEntity, new BattlePhaseContext()); // Manages battle phase (idle, battle, game over)
    world.addComponent(contextEntity, new UIStateContext()); // Manages UI state (paused by modal, message queue)
    world.addComponent(contextEntity, new BattleHistoryContext()); // Manages battle history for AI personalities
    world.addComponent(contextEntity, new UIManager()); // Manages UI elements mapping to entities

    // --- システムの登録 ---
    new InputSystem(world);
    new AiSystem(world);
    new DomFactorySystem(world);
    const actionPanelSystem = new ActionPanelSystem(world);

    const gameFlowSystem = new GameFlowSystem(world);
    const viewSystem = new ViewSystem(world); // アニメーション担当
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const turnSystem = new TurnSystem(world);
    const actionSystem = new ActionSystem(world);
    const combatResolutionSystem = new CombatResolutionSystem(world);
    const actionCancellationSystem = new ActionCancellationSystem(world);
    const movementSystem = new MovementSystem(world);
    const historySystem = new HistorySystem(world);
    const effectSystem = new EffectSystem(world);
    const effectApplicatorSystem = new EffectApplicatorSystem(world);
    const messageSystem = new MessageSystem(world);

    // デバッグモードが有効な場合のみ、DebugSystemをインスタンス化
    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }

    world.registerSystem(gameFlowSystem);
    // MessageSystemを登録。UI系の手前、ロジック系の後が適切。
    world.registerSystem(messageSystem);
    world.registerSystem(historySystem);
    world.registerSystem(stateSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(actionSystem);
    world.registerSystem(combatResolutionSystem);
    // ActionCancellationSystemを登録。StateSystemの前が論理的に自然。
    world.registerSystem(actionCancellationSystem);
    world.registerSystem(movementSystem);
    // EffectApplicatorSystemを登録。ActionSystemの後、他の結果処理系システムの前が適切。
    world.registerSystem(effectApplicatorSystem);
    // EffectSystemを登録 (ActionSystemの後、UI系Systemの前が適切)
    world.registerSystem(effectSystem);
    world.registerSystem(viewSystem);
    world.registerSystem(actionPanelSystem);
    world.registerSystem(new UISystem(world)); // DOM更新担当
}