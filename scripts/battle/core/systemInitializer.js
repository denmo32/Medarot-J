import * as Components from './components/index.js';
import { BattleContext } from './BattleContext.js';
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
// [追加] 新しいPhaseSystemをインポート
import { PhaseSystem } from '../systems/PhaseSystem.js';

/**
 * ゲームに必要なすべてのシステムを初期化し、ワールドに登録します。
 * @param {World} world - ワールドオブジェクト
 */
export function initializeSystems(world) {
    // --- シングルトンコンポーネントの作成 ---
    const contextEntity = world.createEntity();
    world.addComponent(contextEntity, new BattleContext());
    world.addComponent(contextEntity, new UIManager());

    // --- システムの登録 ---
    new InputSystem(world);
    new AiSystem(world);
    new DomFactorySystem(world);
    const actionPanelSystem = new ActionPanelSystem(world);

    const gameFlowSystem = new GameFlowSystem(world);
    // [追加] PhaseSystemをインスタンス化
    const phaseSystem = new PhaseSystem(world);
    const viewSystem = new ViewSystem(world);
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

    if (CONFIG.DEBUG) {
        new DebugSystem(world);
    }

    world.registerSystem(gameFlowSystem);
    // [追加] PhaseSystemを登録。GameFlowの直後が適切。
    world.registerSystem(phaseSystem);
    world.registerSystem(messageSystem);
    world.registerSystem(historySystem);
    world.registerSystem(stateSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(actionSystem);
    world.registerSystem(combatResolutionSystem);
    world.registerSystem(actionCancellationSystem);
    world.registerSystem(movementSystem);
    world.registerSystem(effectApplicatorSystem);
    world.registerSystem(effectSystem);
    world.registerSystem(viewSystem);
    world.registerSystem(actionPanelSystem);
    world.registerSystem(new UISystem(world));
}