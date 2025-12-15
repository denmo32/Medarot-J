/**
 * @file シーン管理クラス
 * @description シーンの切り替え、ライフサイクル管理、UIコンテナの制御を行います。
 * SceneChangeRequestコンポーネントを監視して遷移を実行します。
 */
import { SceneChangeRequest } from '../../scripts/components/SceneRequests.js';

export class SceneManager {
    /**
     * @param {World} world 
     * @param {object} containerMap - シーン名とDOM要素のマッピング
     */
    constructor(world, containerMap = {}) {
        this.world = world;
        this.scenes = new Map();
        this.currentScene = null;
        this.containers = containerMap;

        this.globalContext = {};
        this.persistentComponents = [];
    }

    /**
     * グローバルコンテキストを登録します。
     * @param {string} key
     * @param {any} instance
     */
    registerGlobalContext(key, instance) {
        this.globalContext[key] = instance;
    }

    /**
     * 永続コンポーネントを登録します。
     * @param {object} component
     */
    registerPersistentComponent(component) {
        this.persistentComponents.push(component);
        this.world.addComponent(this.world.createEntity(), component);
    }

    /**
     * シーンを登録します。
     * @param {string} name
     * @param {Scene} sceneClass
     */
    register(name, sceneClass) {
        this.scenes.set(name, new sceneClass(this.world, this));
    }

    /**
     * 指定されたシーンに切り替えます。
     * @param {string} name
     * @param {object} [data={}]
     */
    async switchTo(name, data = {}) {
        if (!this.scenes.has(name)) {
            console.error(`SceneManager: Scene '${name}' not registered.`);
            return;
        }

        if (this.currentScene) {
            this.currentScene.destroy();
        }

        // 永続コンポーネントの再登録
        for (const component of this.persistentComponents) {
            this.world.addComponent(this.world.createEntity(), component);
        }

        this.currentScene = this.scenes.get(name);
        
        // コンテナの表示切替
        Object.keys(this.containers).forEach(key => {
            const container = this.containers[key];
            if (container) {
                if (key === name) {
                    container.classList.remove('hidden');
                } else {
                    container.classList.add('hidden');
                }
            }
        });

        const sceneInitData = { ...this.globalContext, ...data };
        await this.currentScene.init(sceneInitData);
    }

    /**
     * 現在のシーンを更新し、シーン遷移リクエストを監視します。
     * @param {number} deltaTime
     */
    update(deltaTime) {
        if (this.currentScene) {
            this.currentScene.update(deltaTime);
        }

        // シーン遷移リクエストの処理
        // Note: SceneChangeRequestはscripts側で定義されているため、
        // 厳密な依存関係管理としてはmain.js等でクラスを渡すのが良いが、
        // 今回はimportで対応。
        const requestEntities = this.world.getEntitiesWith(SceneChangeRequest);
        for (const entityId of requestEntities) {
            const request = this.world.getComponent(entityId, SceneChangeRequest);
            // リクエストを消費（エンティティ削除）
            this.world.destroyEntity(entityId);
            
            // 遷移実行
            this.switchTo(request.sceneName, request.data);
            
            // 1フレームに1回の遷移のみ許可（ループ中のScene破棄によるエラー防止）
            break; 
        }
    }
}