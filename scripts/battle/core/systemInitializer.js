import * as Components from './components.js';
import { ViewSystem } from '../ui/viewSystem.js';
import { DomFactorySystem } from '../ui/domFactorySystem.js';
import { ActionPanelSystem } from '../ui/actionPanelSystem.js'; // ★新規: ActionPanelSystemをインポート
import { RenderSystem } from '../ui/renderSystem.js';
import { GaugeSystem } from '../systems/gaugeSystem.js';
import { StateSystem } from '../systems/stateSystem.js';
import { InputSystem } from '../ui/inputSystem.js';
import { AiSystem } from '../systems/aiSystem.js';
import { ActionSystem } from '../systems/actionSystem.js';
import { GameFlowSystem } from '../systems/gameFlowSystem.js';
import { MovementSystem } from '../systems/movementSystem.js';
import { HistorySystem } from '../systems/historySystem.js';
import { TurnSystem } from '../systems/turnSystem.js';

/**
 * ゲームに必要なすべてのシステムを初期化し、ワールドに登録します。
 * @param {World} world - ワールドオブジェクト
 */
export function initializeSystems(world) {
    // --- シングルトンコンポーネントの作成 ---
    const contextEntity = world.createEntity();
    world.addComponent(contextEntity, new Components.GameContext());

    // --- システムの登録 ---
    new InputSystem(world);
    new AiSystem(world);
    new DomFactorySystem(world);
    new ActionPanelSystem(world); // ★新規: ActionPanelSystemを登録

    const gameFlowSystem = new GameFlowSystem(world);
    const viewSystem = new ViewSystem(world);
    const renderSystem = new RenderSystem(world);
    const gaugeSystem = new GaugeSystem(world);
    const stateSystem = new StateSystem(world);
    const turnSystem = new TurnSystem(world);
    const actionSystem = new ActionSystem(world);
    const movementSystem = new MovementSystem(world);
    const historySystem = new HistorySystem(world);

    world.registerSystem(gameFlowSystem);
    world.registerSystem(historySystem);
    world.registerSystem(stateSystem);
    world.registerSystem(turnSystem);
    world.registerSystem(gaugeSystem);
    world.registerSystem(actionSystem);
    world.registerSystem(movementSystem);
    world.registerSystem(viewSystem);
    world.registerSystem(renderSystem);
}
