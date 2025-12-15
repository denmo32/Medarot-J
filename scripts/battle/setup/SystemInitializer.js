/**
 * @file SystemInitializer.js
 * @description バトルシーンで使用するSystemの初期化・登録を行う。
 * データの依存関係に基づき、システムの登録順序を厳密に管理する。
 */
import { RenderSystem } from '../systems/visual/RenderSystem.js';
import { AnimationSystem } from '../systems/visual/AnimationSystem.js';
import { VisualDirectorSystem } from '../systems/visual/VisualDirectorSystem.js';
import { ActionPanelSystem } from '../systems/ui/ActionPanelSystem.js';
import { GaugeSystem } from '../systems/mechanics/GaugeSystem.js';
// StateSystem は廃止 (StateTransitionSystemに統合)
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
import { CombatSystem } from '../systems/mechanics/CombatSystem.js';
import { VisualSequenceSystem } from '../systems/visual/VisualSequenceSystem.js';
import { TaskSystem } from '../systems/flow/TaskSystem.js'; 
import { StateTransitionSystem } from '../systems/mechanics/StateTransitionSystem.js';
import { ComponentUpdateSystem } from '../systems/mechanics/ComponentUpdateSystem.js';

import { TimerSystem } from '../../../engine/stdlib/systems/TimerSystem.js';

export function initializeSystems(world, gameDataManager) {

    // --- UI/Input Systems (入力処理) ---
    const uiInputSystem = new UIInputSystem(world);
    const modalSystem = new ModalSystem(world);
    const actionPanelSystem = new ActionPanelSystem(world);

    // --- AI/Player Action Systems (意思決定) ---
    const aiSystem = new AiSystem(world);
    const actionSelectionSystem = new ActionSelectionSystem(world);
    
    // --- Visual Systems (描画・演出) ---
    const renderSystem = new RenderSystem(world);
    const animationSystem = new AnimationSystem(world);
    const visualDirectorSystem = new VisualDirectorSystem(world);
    const visualSequenceSystem = new VisualSequenceSystem(world);

    // --- Flow/Core Systems (進行管理) ---
    const gameFlowSystem = new GameFlowSystem(world);
    const winConditionSystem = new WinConditionSystem(world);
    const turnSystem = new TurnSystem(world);
    const battleSequenceSystem = new BattleSequenceSystem(world); 
    const timerSystem = new TimerSystem(world);
    const taskSystem = new TaskSystem(world);
    
    // --- Mechanics Systems (計算・状態更新) ---
    const gaugeSystem = new GaugeSystem(world);
    // stateSystem は削除
    const movementSystem = new MovementSystem(world);
    const effectSystem = new EffectSystem(world);
    const battleHistorySystem = new BattleHistorySystem(world);
    const combatSystem = new CombatSystem(world);
    const stateTransitionSystem = new StateTransitionSystem(world);
    const componentUpdateSystem = new ComponentUpdateSystem(world);

    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }
    
    // --- システムの登録順序 (Data Flow Pipeline) ---
    
    // 1. 入力とリクエストの受付
    world.registerSystem(uiInputSystem);

    // 2. 基本状態の更新 (汎用的なコンポーネント更新)
    world.registerSystem(stateTransitionSystem); // ゲージ満タン処理などもここで一括管理
    world.registerSystem(componentUpdateSystem);

    // 3. ゲームフロー制御 (フェーズ遷移、ターン管理)
    world.registerSystem(gameFlowSystem);
    world.registerSystem(turnSystem);
    
    // 4. 行動決定 (AI -> ActionSelection)
    world.registerSystem(aiSystem);
    world.registerSystem(actionSelectionSystem);
    
    // 5. 戦闘解決パイプライン (重要: 順序依存)
    // 5-1. CombatSystem: CombatRequest を処理 -> CombatResult を生成
    world.registerSystem(combatSystem);
    // 5-2. BattleHistorySystem: CombatResult を参照して履歴更新 (削除はしない)
    world.registerSystem(battleHistorySystem);
    // 5-3. VisualSequenceSystem: VisualSequenceRequest を処理 -> VisualSequenceResult を生成
    world.registerSystem(visualSequenceSystem);
    // 5-4. BattleSequenceSystem: CombatResult/VisualSequenceResult を消費し、タスクを発行
    world.registerSystem(battleSequenceSystem); 
    
    // 6. タスク実行と演出
    world.registerSystem(taskSystem);
    world.registerSystem(visualDirectorSystem);

    // 7. 勝敗判定 (状態が確定した後に行う)
    world.registerSystem(winConditionSystem);

    // 8. メカニクス更新 (時間経過、移動、エフェクト)
    world.registerSystem(timerSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(movementSystem);
    world.registerSystem(effectSystem);

    // 9. UI状態管理と描画
    world.registerSystem(modalSystem);
    world.registerSystem(actionPanelSystem);
    world.registerSystem(animationSystem);
    world.registerSystem(renderSystem);
}