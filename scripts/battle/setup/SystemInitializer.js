/**
 * @file SystemInitializer.js
 * @description バトルシーンで使用するSystemの初期化・登録を行う。
 */
import { BattleContext } from '../components/BattleContext.js';
import { BattleUIState } from '../components/index.js';
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

import { UIManager } from '../../../engine/ui/UIManager.js';
import { TimerSystem } from '../../../engine/stdlib/systems/TimerSystem.js';

export function initializeSystems(world, gameDataManager) {
    const contextEntity = world.createEntity();
    world.addComponent(contextEntity, new BattleContext());
    world.addComponent(contextEntity, new BattleUIState());
    world.addComponent(contextEntity, new UIManager());

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

    // --- Flow/Core Systems ---
    const gameFlowSystem = new GameFlowSystem(world);
    const winConditionSystem = new WinConditionSystem(world);
    const phaseSystem = new PhaseSystem(world);
    const turnSystem = new TurnSystem(world);
    const battleSequenceSystem = new BattleSequenceSystem(world); 
    const commandSystem = new CommandSystem(world);
    const timerSystem = new TimerSystem(world);
    
    // --- Mechanics Systems ---
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const movementSystem = new MovementSystem(world);
    const effectSystem = new EffectSystem(world);
    const battleHistorySystem = new BattleHistorySystem(world);

    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }
    
    // --- システムの登録順序を整理 ---
    // 1. 入力 → イベントの起点となる入力処理
    world.registerSystem(uiInputSystem);

    // 2. コアロジック (状態更新) → コマンド実行、フェーズ遷移、ターン管理
    world.registerSystem(commandSystem);     // 状態変更コマンドの即時実行
    world.registerSystem(phaseSystem);       // フェーズ状態を管理・遷移
    world.registerSystem(turnSystem);        // ターン進行管理
    world.registerSystem(actionSelectionSystem); // プレイヤー/AIの選択処理
    world.registerSystem(battleSequenceSystem);  // アクション実行シーケンス管理
    world.registerSystem(gameFlowSystem);    // ゲーム全体の進行管理
    world.registerSystem(winConditionSystem); // 勝敗判定
    world.registerSystem(timerSystem);       // 時間管理
    world.registerSystem(stateSystem);       // ゲーム状態（READY_SELECTなど）変更イベント

    // 3. メカニクス (ゲームルール) → ゲージ、移動、エフェクト、履歴
    world.registerSystem(gaugeSystem);       // ゲージ進行管理
    world.registerSystem(movementSystem);    // 移動更新（アニメーション後に反映）
    world.registerSystem(effectSystem);      // エフェクトの時間更新（ターン終了時など）
    world.registerSystem(battleHistorySystem); // 戦闘履歴記録

    // 4. UI状態管理 → モーダル、アクションパネル
    world.registerSystem(modalSystem);       // モーダル表示制御
    world.registerSystem(actionPanelSystem); // アクションUI

    // 5. 描画/演出 → シーン描画、アニメーション、演出演出
    world.registerSystem(visualDirectorSystem); // 演出演出の指揮
    world.registerSystem(animationSystem);   // アニメーション更新
    world.registerSystem(renderSystem);      // 描画処理
}