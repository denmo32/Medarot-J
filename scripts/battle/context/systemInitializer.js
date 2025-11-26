import * as Components from '../components/index.js';
import { BattleContext } from './BattleContext.js';
import { ViewSystem } from '../systems/ui/ViewSystem.js';
import { DomFactorySystem } from '../systems/ui/DomFactorySystem.js';
import { ActionPanelSystem } from '../systems/ui/ActionPanelSystem.js';
import { GaugeSystem } from '../systems/mechanics/GaugeSystem.js';
import { StateSystem } from '../systems/mechanics/StateSystem.js';
import { InputSystem } from '../systems/ui/InputSystem.js';
import { AiSystem } from '../systems/ai/AiSystem.js';
import { GameFlowSystem } from '../systems/flow/GameFlowSystem.js';
import { MovementSystem } from '../systems/mechanics/MovementSystem.js';
import { TurnSystem } from '../systems/flow/TurnSystem.js';
import { EffectSystem } from '../systems/mechanics/EffectSystem.js';
import { MessageSystem } from '../systems/mechanics/MessageSystem.js';
import { ActionCancellationSystem } from '../systems/action/ActionCancellationSystem.js';
import { DebugSystem } from '../systems/ui/DebugSystem.js';
import { CONFIG } from '../../config/gameConfig.js';
import { PhaseSystem } from '../systems/flow/PhaseSystem.js';
import { ActionSelectionSystem } from '../systems/action/ActionSelectionSystem.js';
import { ActionSetupSystem } from '../systems/action/ActionSetupSystem.js';
import { ActionExecutionSystem } from '../systems/action/ActionExecutionSystem.js';
import { ActionResolutionSystem } from '../systems/action/ActionResolutionSystem.js';
import { CooldownSystem } from '../systems/mechanics/CooldownSystem.js';
import { WinConditionSystem } from '../systems/flow/WinConditionSystem.js';
import { BattleHistorySystem } from '../systems/mechanics/BattleHistorySystem.js';
import { UISystem } from '../systems/ui/UISystem.js';

// Engine Imports (Updated)
import { UIManager } from '../../../engine/ui/UIManager.js';
import { TimerSystem } from '../../../engine/stdlib/systems/TimerSystem.js';

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
    const inputSystem = new InputSystem(world);
    const aiSystem = new AiSystem(world);
    const domFactorySystem = new DomFactorySystem(world);
    const actionPanelSystem = new ActionPanelSystem(world);

    const gameFlowSystem = new GameFlowSystem(world);
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
    const battleHistorySystem = new BattleHistorySystem(world);

    // --- システムの登録順序を整理 ---
    world.registerSystem(inputSystem);
    world.registerSystem(aiSystem);
    world.registerSystem(domFactorySystem);
    
    world.registerSystem(gameFlowSystem);
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
    world.registerSystem(battleHistorySystem);
    world.registerSystem(actionCancellationSystem);
    world.registerSystem(movementSystem);
    world.registerSystem(effectSystem);
    world.registerSystem(messageSystem);
    world.registerSystem(viewSystem);
    world.registerSystem(actionPanelSystem);
    world.registerSystem(new UISystem(world));

    if (CONFIG.DEBUG) {
        world.registerSystem(new DebugSystem(world));
    }
}