import * as Components from './components.js';
import { GameModeContext } from './GameModeContext.js';
import { BattlePhaseContext } from './BattlePhaseContext.js';
import { UIStateContext } from './UIStateContext.js';
import { BattleHistoryContext } from './BattleHistoryContext.js';
import { ViewSystem } from '../ui/viewSystem.js';
import { DomFactorySystem } from '../ui/domFactorySystem.js';
import { ActionPanelSystem } from '../ui/actionPanelSystem.js'; // ★新規: ActionPanelSystemをインポート
// ★削除: RenderSystemは廃止されたためインポートしない
// import { RenderSystem } from '../ui/renderSystem.js';
import { GaugeSystem } from '../systems/gaugeSystem.js';
import { StateSystem } from '../systems/stateSystem.js';
import { InputSystem } from '../ui/inputSystem.js';
import { AiSystem } from '../systems/aiSystem.js';
import { ActionSystem } from '../systems/actionSystem.js';
import { GameFlowSystem } from '../systems/gameFlowSystem.js';
import { MovementSystem } from '../systems/movementSystem.js';
import { HistorySystem } from '../systems/historySystem.js';
import { TurnSystem } from '../systems/turnSystem.js';
// ★新規: EffectSystemをインポート
import { EffectSystem } from '../systems/effectSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { UISystem } from '../ui/UISystem.js'; // 追加

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
    // ★削除: RenderSystemは廃止
    // const renderSystem = new RenderSystem(world);
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const turnSystem = new TurnSystem(world);
    const actionSystem = new ActionSystem(world);
    const movementSystem = new MovementSystem(world);
    const historySystem = new HistorySystem(world);
    // ★新規: EffectSystemのインスタンスを作成
    const effectSystem = new EffectSystem(world);


    world.registerSystem(gameFlowSystem);
    world.registerSystem(historySystem);
    world.registerSystem(stateSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(actionSystem);
    world.registerSystem(movementSystem);
    // ★新規: EffectSystemを登録 (ActionSystemの後、UI系Systemの前が適切)
    world.registerSystem(effectSystem);
    world.registerSystem(viewSystem);
    // ★削除: RenderSystemの登録を削除
    // world.registerSystem(renderSystem);
    world.registerSystem(actionPanelSystem);
    world.registerSystem(new UISystem(world)); // DOM更新担当
}