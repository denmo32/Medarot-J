import { BattleContext } from './BattleContext.js';
import { BattleUIState } from '../components/index.js';
import { RenderSystem } from '../systems/visual/RenderSystem.js';
import { AnimationSystem } from '../systems/visual/AnimationSystem.js';
import { ActionPanelSystem } from '../systems/ui/ActionPanelSystem.js';
import { GaugeSystem } from '../systems/mechanics/GaugeSystem.js';
import { StateSystem } from '../systems/mechanics/StateSystem.js';
import { InputSystem } from '../systems/ui/InputSystem.js';
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

import { UIManager } from '../../../engine/ui/UIManager.js';
import { TimerSystem } from '../../../engine/stdlib/systems/TimerSystem.js';

// 削除されたシステム:
// - CooldownSystem (Service化)
// - ActionCancellationSystem (Service化)

/**
 * ゲームに必要なすべてのシステムを初期化し、ワールドに登録します。
 * @param {World} world - ワールドオブジェクト
 */
export function initializeSystems(world) {
    // --- シングルトンコンポーネントの作成 ---
    const contextEntity = world.createEntity();
    world.addComponent(contextEntity, new BattleContext());
    world.addComponent(contextEntity, new BattleUIState()); // UI状態管理コンポーネント
    world.addComponent(contextEntity, new UIManager());

    // --- システムのインスタンス化 ---
    new InputSystem(world);
    new AiSystem(world);
    
    // --- Visual Systems ---
    const renderSystem = new RenderSystem(world);
    const animationSystem = new AnimationSystem(world);

    const actionPanelSystem = new ActionPanelSystem(world);
    const gameFlowSystem = new GameFlowSystem(world);
    const winConditionSystem = new WinConditionSystem(world);
    const phaseSystem = new PhaseSystem(world);
    
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const turnSystem = new TurnSystem(world);
    const movementSystem = new MovementSystem(world);
    const effectSystem = new EffectSystem(world);
    
    const actionSelectionSystem = new ActionSelectionSystem(world);
    const battleSequenceSystem = new BattleSequenceSystem(world); 
    const timerSystem = new TimerSystem(world);
    const battleHistorySystem = new BattleHistorySystem(world);

    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }
    
    // --- システムの登録 ---
    // 登録順序が重要: Logic -> Animation -> Render
    world.registerSystem(gameFlowSystem);
    world.registerSystem(winConditionSystem);
    world.registerSystem(phaseSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(timerSystem);
    // GaugeSystemはフラグ制御になったため、他のロジックシステムより前に動かすか後に動かすかは依存関係次第だが、
    // StateSystemなどでフラグが変わった直後に反映されるよう、Logicフェーズの中盤に配置。
    world.registerSystem(stateSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(actionSelectionSystem);
    
    world.registerSystem(battleSequenceSystem);
    
    world.registerSystem(battleHistorySystem);
    world.registerSystem(movementSystem);
    world.registerSystem(effectSystem);

    // Visual系システム
    world.registerSystem(animationSystem);
    world.registerSystem(renderSystem);
    
    world.registerSystem(actionPanelSystem);
}