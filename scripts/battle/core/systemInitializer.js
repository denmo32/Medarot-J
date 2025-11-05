import * as Components from './components/index.js';
import { BattleContext } from './BattleContext.js';
import { ViewSystem } from '../ui/viewSystem.js';
import { DomFactorySystem } from '../ui/domFactorySystem.js';
import { ActionPanelSystem } from '../ui/actionPanelSystem.js';
import { GaugeSystem } from '../systems/gaugeSystem.js';
import { StateSystem } from '../systems/stateSystem.js';
import { InputSystem } from '../ui/inputSystem.js';
import { AiSystem } from '../systems/aiSystem.js';
import { GameFlowSystem } from '../systems/gameFlowSystem.js';
import { MovementSystem } from '../systems/movementSystem.js';
import { TurnSystem } from '../systems/turnSystem.js';
import { EffectSystem } from '../systems/effectSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { UISystem } from '../ui/UISystem.js';
import { MessageSystem } from '../systems/MessageSystem.js';
import { ActionCancellationSystem } from '../systems/actionCancellationSystem.js';
import { DebugSystem } from '../systems/DebugSystem.js';
import { CONFIG } from '../common/config.js';
import { PhaseSystem } from '../systems/PhaseSystem.js';
import { ActionSelectionSystem } from '../systems/ActionSelectionSystem.js';
import { ActionSetupSystem } from '../systems/ActionSetupSystem.js';
import { ActionExecutionSystem } from '../systems/ActionExecutionSystem.js';
import { ActionResolutionSystem } from '../systems/ActionResolutionSystem.js';
import { TimerSystem } from '../../core/systems/TimerSystem.js';
import { CooldownSystem } from '../systems/cooldownSystem.js';
import { WinConditionSystem } from '../systems/WinConditionSystem.js';

/**
 * ゲームに必要なすべてのシステムを初期化し、ワールドに登録します。
 * @param {World} world - ワールドオブジェクト
 */
export function initializeSystems(world) {
    // --- シングルトンコンポーネントの作成 ---
    const contextEntity = world.createEntity();
    world.addComponent(contextEntity, new BattleContext());
    world.addComponent(contextEntity, new UIManager());

    // --- システムのインスタンス化 ---
    new InputSystem(world);
    new AiSystem(world);
    new DomFactorySystem(world);
    const actionPanelSystem = new ActionPanelSystem(world);

    const gameFlowSystem = new GameFlowSystem(world);
    // WinConditionSystemをインスタンス化
    const winConditionSystem = new WinConditionSystem(world);
    const phaseSystem = new PhaseSystem(world);
    const viewSystem = new ViewSystem(world);
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const turnSystem = new TurnSystem(world);
    const movementSystem = new MovementSystem(world);
    const effectSystem = new EffectSystem(world);
    const messageSystem = new MessageSystem(world);
    const actionCancellationSystem = new ActionCancellationSystem(world);
    const actionSelectionSystem = new ActionSelectionSystem(world);
    const actionSetupSystem = new ActionSetupSystem(world);
    const actionResolutionSystem = new ActionResolutionSystem(world);
    const actionExecutionSystem = new ActionExecutionSystem(world);
    const timerSystem = new TimerSystem(world);
    const cooldownSystem = new CooldownSystem(world);

    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }
    
    // --- システムの登録順序を整理 ---
    world.registerSystem(gameFlowSystem);
    // WinConditionSystemを登録。勝利判定はゲームフローの直後が自然
    world.registerSystem(winConditionSystem);
    world.registerSystem(phaseSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(timerSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(stateSystem);
    world.registerSystem(cooldownSystem);
    world.registerSystem(actionSelectionSystem);
    world.registerSystem(actionSetupSystem);
    world.registerSystem(actionExecutionSystem);
    world.registerSystem(actionResolutionSystem);
    world.registerSystem(actionCancellationSystem);
    world.registerSystem(movementSystem);
    world.registerSystem(effectSystem);
    world.registerSystem(messageSystem);
    world.registerSystem(viewSystem);
    world.registerSystem(actionPanelSystem);
    world.registerSystem(new UISystem(world));
}