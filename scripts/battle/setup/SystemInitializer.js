/**
 * @file SystemInitializer.js
 * @description システム初期化。
 */
import { RenderSystem } from '../systems/visual/RenderSystem.js';
import { AnimationSystem } from '../systems/visual/AnimationSystem.js';
import { VisualDirectorSystem } from '../systems/visual/VisualDirectorSystem.js';
import { ActionPanelSystem } from '../systems/ui/ActionPanelSystem.js';
import { GaugeSystem } from '../systems/mechanics/GaugeSystem.js';
import { AiSystem } from '../systems/ai/AiSystem.js';
import { GameFlowSystem } from '../systems/flow/GameFlowSystem.js';
import { MovementSystem } from '../systems/mechanics/MovementSystem.js';
import { TurnSystem } from '../systems/flow/TurnSystem.js';
import { EffectSystem } from '../systems/mechanics/EffectSystem.js';
import { DebugSystem } from '../systems/ui/DebugSystem.js';
import { CONFIG } from '../common/config.js';
import { ActionSelectionSystem } from '../systems/action/ActionSelectionSystem.js';
import { WinConditionSystem } from '../systems/flow/WinConditionSystem.js';
import { BattleHistorySystem } from '../systems/mechanics/BattleHistorySystem.js';
import { BattleSequenceSystem } from '../systems/flow/BattleSequenceSystem.js';
import { ModalSystem } from '../systems/ui/ModalSystem.js';
import { UIInputSystem } from '../systems/ui/UIInputSystem.js';

import { TargetingSystem } from '../systems/mechanics/TargetingSystem.js';
import { ActionExecutionSystem } from '../systems/mechanics/ActionExecutionSystem.js';

import { EffectProcessorSystem } from '../systems/mechanics/EffectProcessorSystem.js';
import { CombatResultSystem } from '../systems/mechanics/CombatResultSystem.js';

import { VisualSequenceSystem } from '../systems/visual/VisualSequenceSystem.js';
import { TaskSystem } from '../systems/flow/TaskSystem.js'; 
import { StateTransitionSystem } from '../systems/mechanics/StateTransitionSystem.js';
import { ComponentUpdateSystem } from '../systems/mechanics/ComponentUpdateSystem.js';

import { TimerSystem } from '../../../engine/stdlib/systems/TimerSystem.js';

import { EffectRegistry } from '../definitions/EffectRegistry.js';
import { TraitRegistry } from '../definitions/traits/TraitRegistry.js';

export function initializeSystems(world, gameDataManager) {

    // 初期化処理
    EffectRegistry.initialize();
    TraitRegistry.initialize();

    const uiInputSystem = new UIInputSystem(world);
    const modalSystem = new ModalSystem(world);
    const actionPanelSystem = new ActionPanelSystem(world);

    const aiSystem = new AiSystem(world);
    const actionSelectionSystem = new ActionSelectionSystem(world);
    
    const renderSystem = new RenderSystem(world);
    const animationSystem = new AnimationSystem(world);
    const visualDirectorSystem = new VisualDirectorSystem(world);
    const visualSequenceSystem = new VisualSequenceSystem(world);

    const gameFlowSystem = new GameFlowSystem(world);
    const winConditionSystem = new WinConditionSystem(world);
    const turnSystem = new TurnSystem(world);
    const battleSequenceSystem = new BattleSequenceSystem(world); 
    const timerSystem = new TimerSystem(world);
    const taskSystem = new TaskSystem(world);
    
    const gaugeSystem = new GaugeSystem(world);
    const movementSystem = new MovementSystem(world);
    const effectSystem = new EffectSystem(world); 
    const battleHistorySystem = new BattleHistorySystem(world);
    const stateTransitionSystem = new StateTransitionSystem(world);
    const componentUpdateSystem = new ComponentUpdateSystem(world);

    const targetingSystem = new TargetingSystem(world);
    const actionExecutionSystem = new ActionExecutionSystem(world);

    const effectProcessorSystem = new EffectProcessorSystem(world);
    const combatResultSystem = new CombatResultSystem(world);

    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }
    
    world.registerSystem(uiInputSystem);
    world.registerSystem(stateTransitionSystem); 
    world.registerSystem(componentUpdateSystem);
    world.registerSystem(gameFlowSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(aiSystem);
    world.registerSystem(actionSelectionSystem);
    world.registerSystem(battleSequenceSystem); 
    world.registerSystem(targetingSystem);
    world.registerSystem(actionExecutionSystem);
    world.registerSystem(effectProcessorSystem);
    world.registerSystem(combatResultSystem);
    world.registerSystem(battleHistorySystem);
    world.registerSystem(visualSequenceSystem);
    world.registerSystem(taskSystem);
    world.registerSystem(visualDirectorSystem);
    world.registerSystem(winConditionSystem);
    world.registerSystem(timerSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(movementSystem);
    world.registerSystem(effectSystem);
    world.registerSystem(modalSystem);
    world.registerSystem(actionPanelSystem);
    world.registerSystem(animationSystem);
    world.registerSystem(renderSystem);
}