/**
 * @file BattleScene.js
 */
import { Scene } from '../../engine/scene/Scene.js';
import { GameEvents } from '../common/events.js';
import { initializeSystems } from '../battle/setup/SystemInitializer.js';
import { createPlayers } from '../battle/setup/EntityFactory.js';
import { TurnContext } from '../battle/components/TurnContext.js';
import { PhaseContext } from '../battle/components/PhaseContext.js';
import { BattleStateContext } from '../battle/components/BattleStateContext.js';
import { BattleSequenceContext } from '../battle/components/BattleSequenceContext.js';
import { BattleHistoryContext } from '../battle/components/BattleHistoryContext.js';
import { HookContext } from '../battle/components/HookContext.js';
import { BattleUIState } from '../battle/components/BattleUIState.js';
import { UIManager } from '../../engine/ui/UIManager.js';

export class BattleScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    init(data) {
        console.log("Initializing Battle Scene...");
        const { gameDataManager } = data;

        // 重要: 以下の初期化順序は依存関係を考慮して決定されています
        // _setupBattleContext() で各種 Context コンポーネントを登録した後、
        // _setupSystems() でそれらのコンポーネントを使用するシステムを初期化します
        // この順序を変更すると、システムがコンポーネントを取得できずエラーが発生する可能性があります
        this._setupEntities(gameDataManager);
        this._setupBattleContext();
        this._setupSystems(gameDataManager);

        this._bindEvents(gameDataManager);

        this.world.emit(GameEvents.SETUP_UI_REQUESTED);
        this.world.emit(GameEvents.GAME_START_CONFIRMED);
    }

    _setupSystems(gameDataManager) {
        initializeSystems(this.world, gameDataManager);
    }

    _setupEntities(gameDataManager) {
        const playerTeamData = gameDataManager.getPlayerDataForBattle();
        createPlayers(this.world, playerTeamData);
    }

    _setupBattleContext() {
        // 新しいContextクラスのインスタンスを登録するための専用エンティティを作成
        const contextEntity = this.world.createEntity();

        // 各Contextの新しいインスタンスを登録
        this.world.addComponent(contextEntity, new TurnContext());
        this.world.addComponent(contextEntity, new PhaseContext());
        this.world.addComponent(contextEntity, new BattleStateContext());
        this.world.addComponent(contextEntity, new BattleSequenceContext());
        this.world.addComponent(contextEntity, new BattleHistoryContext());
        this.world.addComponent(contextEntity, new HookContext());

        // UI関連コンポーネントの登録（システム初期化前に必要）
        const uiContextEntity = this.world.createEntity();
        this.world.addComponent(uiContextEntity, new BattleUIState());
        this.world.addComponent(uiContextEntity, new UIManager());
    }

    _bindEvents(gameDataManager) {
        this.world.on(GameEvents.SCENE_CHANGE_REQUESTED, (detail) => {
            if (detail.data && detail.data.result) {
                gameDataManager.applyBattleResult(detail.data.result);
            }
            this.sceneManager.switchTo(detail.sceneName, detail.data);
        });

        this.world.on(GameEvents.RESET_BUTTON_CLICKED, () => {
            this.world.emit(GameEvents.SCENE_CHANGE_REQUESTED, {
                sceneName: 'map',
                data: {}
            });
        });
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Battle Scene...");
        super.destroy();
    }
}