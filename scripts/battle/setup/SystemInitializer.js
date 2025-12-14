/**
 * @file SystemInitializer.js
 * @description バトルシーンで使用するSystemの初期化・登録を行う。
 */
import { RenderSystem } from '../systems/visual/RenderSystem.js';
import { AnimationSystem } from '../systems/visual/AnimationSystem.js';
import { VisualDirectorSystem } from '../systems/visual/VisualDirectorSystem.js';
import { ActionPanelSystem } from '../systems/ui/ActionPanelSystem.js';
import { GaugeSystem } from '../systems/mechanics/GaugeSystem.js';
import { StateSystem } from '../systems/mechanics/StateSystem.js';
import { AiSystem } from '../systems/ai/AiSystem.js';
import { GameFlowSystem } from '../systems/flow/GameFlowSystem.js';
import { MovementSystem } from '../systems/mechanics/MovementSystem.js';
import { TurnSystem } from '../systems/flow/TurnSystem.js';
import { EffectSystem } from '../systems/mechanics/EffectSystem.js';
import { DebugSystem } from '../systems/ui/DebugSystem.js';
import { CONFIG } from '../common/config.js';
import { PhaseSystem } from '../systems/flow/PhaseSystem.js';
import { ActionSelectionSystem } from '../systems/action/ActionSelectionSystem.js';
import { WinConditionSystem } from '../systems/flow/WinConditionSystem.js';
import { BattleHistorySystem } from '../systems/mechanics/BattleHistorySystem.js';
import { BattleSequenceSystem } from '../systems/flow/BattleSequenceSystem.js';
import { CommandSystem } from '../systems/flow/CommandSystem.js';
import { ModalSystem } from '../systems/ui/ModalSystem.js';
import { UIInputSystem } from '../systems/ui/UIInputSystem.js';
import { CombatSystem } from '../systems/mechanics/CombatSystem.js';
import { VisualSequenceSystem } from '../systems/visual/VisualSequenceSystem.js';
import { TaskSystem } from '../systems/flow/TaskSystem.js'; // New

import { TimerSystem } from '../../../engine/stdlib/systems/TimerSystem.js';

export function initializeSystems(world, gameDataManager) {

    // --- UI/Input Systems ---
    const uiInputSystem = new UIInputSystem(world);
    const modalSystem = new ModalSystem(world);
    const actionPanelSystem = new ActionPanelSystem(world);

    // --- AI/Player Action Systems ---
    new AiSystem(world);
    const actionSelectionSystem = new ActionSelectionSystem(world);
    
    // --- Visual Systems ---
    const renderSystem = new RenderSystem(world);
    const animationSystem = new AnimationSystem(world);
    const visualDirectorSystem = new VisualDirectorSystem(world);
    const visualSequenceSystem = new VisualSequenceSystem(world);

    // --- Flow/Core Systems ---
    const gameFlowSystem = new GameFlowSystem(world);
    const winConditionSystem = new WinConditionSystem(world);
    const phaseSystem = new PhaseSystem(world);
    const turnSystem = new TurnSystem(world);
    const battleSequenceSystem = new BattleSequenceSystem(world); 
    const commandSystem = new CommandSystem(world);
    const timerSystem = new TimerSystem(world);
    const taskSystem = new TaskSystem(world); // New
    
    // --- Mechanics Systems ---
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const movementSystem = new MovementSystem(world);
    const effectSystem = new EffectSystem(world);
    const battleHistorySystem = new BattleHistorySystem(world);
    const combatSystem = new CombatSystem(world);

    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }
    
    // --- システムの登録順序を整理 ---
    // 1. 入力
    world.registerSystem(uiInputSystem);

    // 2. コアロジック (状態更新)
    world.registerSystem(commandSystem);
    world.registerSystem(phaseSystem);
    world.registerSystem(gameFlowSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(actionSelectionSystem);
    
    world.registerSystem(battleSequenceSystem); 
    world.registerSystem(combatSystem);
    world.registerSystem(visualSequenceSystem);
    
    // TaskSystem: VisualSequenceを持つエンティティにタスクコンポーネントを付与する
    world.registerSystem(taskSystem);

    world.registerSystem(winConditionSystem);
    world.registerSystem(timerSystem);
    world.registerSystem(stateSystem);

    // 3. メカニクス
    world.registerSystem(gaugeSystem);
    world.registerSystem(movementSystem);
    world.registerSystem(effectSystem);
    world.registerSystem(battleHistorySystem);

    // 4. UI状態管理
    world.registerSystem(modalSystem);
    world.registerSystem(actionPanelSystem);

    // 5. 描画/演出
    world.registerSystem(visualDirectorSystem);
    world.registerSystem(animationSystem);
    world.registerSystem(renderSystem);
}