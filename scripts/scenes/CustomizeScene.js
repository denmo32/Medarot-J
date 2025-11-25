/**
 * @file CustomizeScene.js
 * @description カスタマイズ画面のセットアップとロジックをカプセル化するシーンクラス。
 */
import { BaseScene } from '../engine/BaseScene.js';
import { CustomizeInputSystem } from '../customize/systems/CustomizeInputSystem.js';
import { CustomizeUISystem } from '../customize/systems/CustomizeUISystem.js';
import { CustomizeLogicSystem } from '../customize/systems/CustomizeLogicSystem.js';
import { CustomizeState } from '../customize/components/CustomizeState.js';
import { GameEvents } from '../battle/common/events.js';

export class CustomizeScene extends BaseScene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
    }

    /**
     * @param {CustomizeSceneData} data - シーンの初期化データ。
     */
    init(data) {
        console.log("Initializing Customize Scene...");
        
        this._setupContexts();
        this._setupSystems();
        this._bindEvents();
    }

    /**
     * シーン固有のコンテキスト（状態）をセットアップします。
     * @private
     */
    _setupContexts() {
        // カスタマイズシーンはバトルと状態を共有しないため、独自のコンポーネントを使用
        const contextEntity = this.world.createEntity();
        this.world.addComponent(contextEntity, new CustomizeState());
    }

    /**
     * システム群を初期化・登録します。
     * @private
     */
    _setupSystems() {
        this.world.registerSystem(new CustomizeUISystem(this.world));
        this.world.registerSystem(new CustomizeInputSystem(this.world));
        this.world.registerSystem(new CustomizeLogicSystem(this.world));
    }

    /**
     * イベントリスナーを設定します。
     * @private
     */
    _bindEvents() {
        this.world.on(GameEvents.CUSTOMIZE_EXIT_REQUESTED, () => {
            // 前のシーン（マップ）に戻る。メニューを開いた状態を復元するフラグを渡す。
            this.sceneManager.switchTo('map', { restoreMenu: true });
        });
    }

    update(deltaTime) {
        super.update(deltaTime);
    }

    destroy() {
        console.log("Destroying Customize Scene...");
        // CustomizeUISystemがDOMを非表示にする処理を持つため、明示的に呼び出す
        const customizeUISystem = this.world.systems.find(s => s instanceof CustomizeUISystem);
        if (customizeUISystem && customizeUISystem.destroy) {
            customizeUISystem.destroy();
        }
        super.destroy();
    }
}