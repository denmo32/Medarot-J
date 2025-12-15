/**
 * @file BattleScene.js
 * @description バトルシーンクラス。
 * イベントバインディングを削除し、システムによる自律動作に任せます。
 */
import { Scene } from '../../engine/scene/Scene.js';
import { initializeSystems } from '../battle/setup/SystemInitializer.js';
import { createPlayers } from '../battle/setup/EntityFactory.js';
import { TurnContext } from '../battle/components/TurnContext.js';
import { PhaseState } from '../battle/components/PhaseState.js';
import { BattleHistoryContext } from '../battle/components/BattleHistoryContext.js';
import { HookContext } from '../battle/components/HookContext.js';
import { BattleUIState } from '../battle/components/BattleUIState.js';
import { UIManager } from '../../engine/ui/UIManager.js';
import { SceneChangeRequest } from '../components/SceneRequests.js';

export class BattleScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager } = data;

        this._setupEntities(gameDataManager);
        this._setupBattleContext();
        this._setupSystems(gameDataManager);

        // UI初期化は各Systemのコンストラクタやupdateで行われるため、イベント発行は不要
        // 必要な初期化リクエストがあればここでコンポーネントを追加する
    }

    _setupSystems(gameDataManager) {
        initializeSystems(this.world, gameDataManager);
    }

    _setupEntities(gameDataManager) {
        const playerTeamData = gameDataManager.gameData.playerMedarots;
        createPlayers(this.world, playerTeamData);
    }

    _setupBattleContext() {
        const contextEntity = this.world.createEntity();

        this.world.addComponent(contextEntity, new TurnContext());
        this.world.addComponent(contextEntity, new PhaseState());
        this.world.addComponent(contextEntity, new BattleHistoryContext());
        this.world.addComponent(contextEntity, new HookContext());

        const uiContextEntity = this.world.createEntity();
        this.world.addComponent(uiContextEntity, new BattleUIState());
        this.world.addComponent(uiContextEntity, new UIManager());
    }

    update(deltaTime) {
        super.update(deltaTime);
        
        // BattleResultの適用などの後処理があればここで行うこともできるが、
        // 基本的にGameFlowSystemがSceneChangeRequestを発行し、
        // SceneManagerがそれに従って遷移する流れとなる。
        // ここで特別な処理は不要。
        
        // 結果適用ロジックは SceneManager の switchTo か、あるいは
        // GameFlowSystem が GameDataManager を直接参照して行う形が自然。
        // 今回は GameFlowSystem が SceneChangeRequest にデータを載せ、
        // 次のシーン (MapScene) の init で gameDataManager.applyBattleResult を呼ぶ形も考えられる。
    }

    destroy() {
        console.log("Destroying Battle Scene...");
        super.destroy();
    }
}